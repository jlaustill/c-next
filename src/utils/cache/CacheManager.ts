/**
 * CacheManager
 *
 * Manages persistent cache for parsed C/C++ header symbols using flat-cache.
 * Cache is stored in .cnx/ directory (similar to .git/).
 *
 * Cache structure:
 *   .cnx/
 *     config.json     - Cache metadata (version, timestamps)
 *     cache/
 *       symbols.json  - Cached symbols per file (managed by flat-cache)
 */

import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { FlatCache, create as createFlatCache } from "flat-cache";
import CacheKeyGenerator from "./CacheKeyGenerator";
import JsonCodec from "./JsonCodec";
import CachedSymbolReader from "./CachedSymbolReader";
import IStructFieldInfo from "../../transpiler/types/symbols/IStructFieldInfo";
import SymbolTable from "../../transpiler/logic/symbols/SymbolTable";
import ICacheConfig from "../../transpiler/types/ICacheConfig";
import ICachedFileEntry from "../../transpiler/types/ICachedFileEntry";
import IStructSymbolState from "../../transpiler/types/symbols/IStructSymbolState";
import TJsonSafe from "../types/TJsonSafe";
import TJsonValue from "../types/TJsonValue";
import IFileSystem from "../../transpiler/types/IFileSystem";
import NodeFileSystem from "../../transpiler/NodeFileSystem";
import packageJson from "../../../package.json" with { type: "json" };
import ESourceLanguage from "../types/ESourceLanguage";

/** Default file system instance (singleton for performance) */
const defaultFs = NodeFileSystem.instance;

/** Current cache format version - increment when serialization format changes */
// Bump when the ENTRY shape changes in a way no fingerprint can see -- the
// TCSymbol/TCppSymbol unions are types, so their keys cannot be enumerated at
// runtime. Struct-state drift no longer needs a bump: STRUCT_STATE_SHAPE below
// is derived and invalidates on its own.
const CACHE_VERSION = 9; // Issue #1225: real typed symbols; struct state captured whole

const TRANSPILER_VERSION = packageJson.version;

/**
 * Fingerprint of the struct-state shape, derived from the serializer itself.
 *
 * Issue #1225 review: `TJsonSafe<Required<IStructSymbolState>>` forces the
 * writer to persist a new field, but nothing forced already-written entries to
 * be discarded -- that was CACHE_VERSION, bumped by hand, so the compile error
 * told the next person to write the field without mentioning a second step.
 * Deriving it closes the loop for exactly the change that needs it.
 *
 * Not sorted. `Object.keys` returns string keys in insertion order, which for
 * an object literal is the order written in `serializeStructState` -- already
 * deterministic. Sorting would need a comparator to satisfy SonarCloud S2871,
 * and the obvious one, `localeCompare`, makes a cache fingerprint depend on the
 * reader's locale. Reordering that literal changes the fingerprint and
 * invalidates once, which costs a re-parse and nothing else.
 */
const STRUCT_STATE_SHAPE = SymbolTable.structStateKeys().join(",");

/**
 * Manages symbol cache for faster incremental builds
 */
class CacheManager {
  private readonly projectRoot: string;
  private readonly cacheDir: string;
  private readonly cacheSubdir: string;
  private readonly configPath: string;
  private readonly fs: IFileSystem;

  /** flat-cache instance for symbol storage */
  private cache: FlatCache | null = null;

  /** Whether the cache has been modified and needs flushing */
  private dirty = false;

  constructor(projectRoot: string, fs: IFileSystem = defaultFs) {
    this.projectRoot = projectRoot;
    this.fs = fs;
    this.cacheDir = join(projectRoot, ".cnx");
    this.cacheSubdir = join(this.cacheDir, "cache");
    this.configPath = join(this.cacheDir, "config.json");
  }

  /**
   * Initialize the cache directory and load existing cache
   */
  async initialize(): Promise<void> {
    // Create .cnx directory structure
    if (!this.fs.exists(this.cacheDir)) {
      this.fs.mkdir(this.cacheDir, { recursive: true });
    }

    if (!this.fs.exists(this.cacheSubdir)) {
      this.fs.mkdir(this.cacheSubdir, { recursive: true });
    }

    // Load or create config
    const config = this.loadOrCreateConfig();

    // Check if cache should be invalidated
    if (this.shouldInvalidateCache(config)) {
      // Remove old cache file if it exists
      // Note: flat-cache manages the actual file, so we use existsSync/unlinkSync here
      const oldCacheFile = join(this.cacheSubdir, "symbols");
      if (existsSync(oldCacheFile)) {
        try {
          unlinkSync(oldCacheFile);
        } catch {
          // Ignore if we can't delete
        }
      }
      // Create fresh cache
      this.cache = createFlatCache({
        cacheId: "symbols",
        cacheDir: this.cacheSubdir,
      });
      this.saveConfig();
      return;
    }

    // Load existing cache - create also loads if file exists
    this.cache = createFlatCache({
      cacheId: "symbols",
      cacheDir: this.cacheSubdir,
    });

    // Issue #1225: drop anything written in an older entry shape
    this.discardOutdatedEntries();
  }

  /**
   * Check if a file's cache is valid (not modified since cached)
   */
  isValid(filePath: string): boolean {
    if (!this.cache) return false;

    const entry = this.cache.getKey(filePath);
    if (!entry) {
      return false;
    }

    return CacheKeyGenerator.isValid(
      filePath,
      (entry as ICachedFileEntry).cacheKey,
      this.fs,
    );
  }

  /**
   * Get cached symbols and struct fields for a file.
   *
   * Issue #1225: `symbols` comes back as the JSON the file holds; callers run
   * it through `CachedSymbolReader` to validate and revive it.
   */
  getSymbols(filePath: string): {
    symbols: TJsonValue[];
    structFields: Map<string, Map<string, IStructFieldInfo>>;
    needsStructKeyword: string[];
    enumBitWidth: Map<string, number>;
    structState: TJsonSafe<Required<IStructSymbolState>>;
    preprocessFailed: boolean;
  } | null {
    if (!this.cache) return null;

    const entry = this.cache.getKey(filePath);
    if (!entry) {
      return null;
    }
    const cachedEntry = entry as ICachedFileEntry;

    // Issue #1225: entries come off disk, so the type annotation above is a
    // claim rather than a guarantee. Struct state is validated the same way
    // symbols are -- an entry whose struct state is the wrong shape, or is
    // merely missing a key, reads as a miss rather than throwing out of the
    // transpile or restoring a silently empty Set.
    const structState = CachedSymbolReader.readStructState(
      cachedEntry.structState,
    );
    if (structState === null) {
      return null;
    }

    const symbols = cachedEntry.symbols;

    // Convert struct fields from plain objects to Maps
    const structFields = new Map<string, Map<string, IStructFieldInfo>>();
    for (const [structName, fields] of Object.entries(
      cachedEntry.structFields,
    )) {
      const fieldMap = new Map<string, IStructFieldInfo>();
      for (const [fieldName, fieldInfo] of Object.entries(fields)) {
        fieldMap.set(fieldName, fieldInfo);
      }
      structFields.set(structName, fieldMap);
    }

    // Issue #208: Convert enum bit widths from plain object to Map
    const enumBitWidth = new Map<string, number>();
    if (cachedEntry.enumBitWidth) {
      for (const [enumName, width] of Object.entries(
        cachedEntry.enumBitWidth,
      )) {
        enumBitWidth.set(enumName, width);
      }
    }

    return {
      symbols,
      structFields,
      needsStructKeyword: cachedEntry.needsStructKeyword ?? [],
      enumBitWidth,
      structState,
      preprocessFailed: cachedEntry.preprocessFailed ?? false,
    };
  }

  /**
   * Store symbols and struct fields for a file.
   *
   * Issue #1225: `structState` is required rather than optional. An entry that
   * cannot carry the struct state is exactly the half-written entry this bug
   * was made of, so the type refuses to express one.
   */
  setSymbols(
    filePath: string,
    symbols: TJsonValue[],
    structFields: Map<string, Map<string, IStructFieldInfo>>,
    options: {
      structState: TJsonSafe<Required<IStructSymbolState>>;
      needsStructKeyword?: string[];
      enumBitWidth?: Map<string, number>;
      preprocessFailed?: boolean;
    },
  ): void {
    if (!this.cache) return;

    // Generate cache key for current file state
    let cacheKey: string;
    try {
      cacheKey = CacheKeyGenerator.generate(filePath, this.fs);
    } catch {
      // If we can't stat the file, don't cache it
      return;
    }

    // Convert struct fields from Maps to plain objects
    const serializedFields: Record<
      string,
      Record<string, IStructFieldInfo>
    > = {};
    for (const [structName, fields] of structFields) {
      serializedFields[structName] = {};
      for (const [fieldName, fieldInfo] of fields) {
        serializedFields[structName][fieldName] = fieldInfo;
      }
    }

    // Issue #208: Convert enum bit widths from Map to plain object
    const serializedEnumBitWidth: Record<string, number> = {};
    if (options.enumBitWidth) {
      for (const [enumName, width] of options.enumBitWidth) {
        serializedEnumBitWidth[enumName] = width;
      }
    }

    // Create entry
    const entry: ICachedFileEntry = {
      filePath,
      cacheKey,
      symbols,
      structFields: serializedFields,
      needsStructKeyword: options.needsStructKeyword,
      enumBitWidth: serializedEnumBitWidth,
      structState: options.structState,
      preprocessFailed: options.preprocessFailed,
    };

    this.cache.setKey(filePath, entry);
    this.dirty = true;
  }

  /**
   * Issue #590: Store symbols from a SymbolTable for a specific file.
   * Extracts all necessary data (symbols, struct fields, enum bit widths)
   * from the SymbolTable and caches it.
   *
   * This method encapsulates the serialization logic that was previously
   * scattered in Transpiler, providing a cleaner API for callers.
   *
   * @param filePath - Path to the file being cached
   * @param symbolTable - SymbolTable containing all parsed symbols
   * @param preprocessFailed - Issue #985: header fell back to raw content, so its
   *   symbols are degraded and a warm-cache build must re-run recovery
   */
  setSymbolsFromTable(
    filePath: string,
    symbolTable: SymbolTable,
    preprocessFailed = false,
  ): void {
    // Issue #1225: encode the real typed symbols. JsonCodec copies every
    // field rather than naming any, so a field added to the symbol model is
    // cached without anyone editing this method -- which is what the old
    // field-by-field serializer could not do.
    //
    // C-Next symbols are re-parsed from source every run and are never cached;
    // filtering them states that invariant instead of relying on no .cnx file
    // ever reaching this call site.
    const symbols = symbolTable
      .getSymbolsByFile(filePath)
      .filter((symbol) => symbol.sourceLanguage !== ESourceLanguage.CNext)
      .map((symbol) => JsonCodec.encode(symbol));

    // Extract struct fields for structs defined in this file
    const structFields = this.extractStructFieldsForFile(filePath, symbolTable);

    // Extract struct names that need 'struct' keyword
    const needsStructKeyword = this.extractNeedsStructKeywordForFile(
      filePath,
      symbolTable,
    );

    // Extract enum bit widths for enums defined in this file
    const enumBitWidth = this.extractEnumBitWidthsForFile(
      filePath,
      symbolTable,
    );

    this.setSymbols(filePath, symbols, structFields, {
      structState: symbolTable.serializeStructState(),
      needsStructKeyword,
      enumBitWidth,
      preprocessFailed,
    });
  }

  /**
   * Issue #590: Extract struct fields for structs defined in a specific file.
   */
  private extractStructFieldsForFile(
    filePath: string,
    symbolTable: SymbolTable,
  ): Map<string, Map<string, IStructFieldInfo>> {
    const result = new Map<string, Map<string, IStructFieldInfo>>();

    // Get struct names defined in this file
    const structNames = symbolTable.getStructNamesByFile(filePath);

    // Get fields for each struct
    const allStructFields = symbolTable.getAllStructFields();
    for (const structName of structNames) {
      const fields = allStructFields.get(structName);
      if (fields) {
        result.set(structName, fields);
      }
    }

    return result;
  }

  /**
   * Issue #590: Extract struct names requiring 'struct' keyword for a specific file.
   */
  private extractNeedsStructKeywordForFile(
    filePath: string,
    symbolTable: SymbolTable,
  ): string[] {
    // Get struct names defined in this file
    const structNames = symbolTable.getStructNamesByFile(filePath);

    // Filter to only those that need struct keyword
    const allNeedsKeyword = symbolTable.getAllNeedsStructKeyword();
    return structNames.filter((name) => allNeedsKeyword.includes(name));
  }

  /**
   * Issue #590: Extract enum bit widths for enums defined in a specific file.
   */
  private extractEnumBitWidthsForFile(
    filePath: string,
    symbolTable: SymbolTable,
  ): Map<string, number> {
    const result = new Map<string, number>();

    // Get enum names defined in this file
    const fileSymbols = symbolTable.getSymbolsByFile(filePath);
    const enumNames = fileSymbols
      .filter((s) => s.kind === "enum")
      .map((s) => s.name);

    // Get bit widths for each enum
    const allBitWidths = symbolTable.getAllEnumBitWidths();
    for (const enumName of enumNames) {
      const width = allBitWidths.get(enumName);
      if (width !== undefined) {
        result.set(enumName, width);
      }
    }

    return result;
  }

  /**
   * Invalidate cache for a specific file
   */
  invalidate(filePath: string): void {
    if (!this.cache) return;

    this.cache.removeKey(filePath);
    this.dirty = true;
  }

  /**
   * Invalidate all cached entries
   */
  invalidateAll(): void {
    if (this.cache) {
      // Clear all entries
      this.cache.clear();
    } else {
      // Create fresh cache if not initialized
      this.cache = createFlatCache({
        cacheId: "symbols",
        cacheDir: this.cacheSubdir,
      });
    }
    this.dirty = true;
  }

  /**
   * Flush cache to disk if modified
   */
  async flush(): Promise<void> {
    if (!this.dirty || !this.cache) {
      return;
    }

    this.cache.save();
    this.dirty = false;
  }

  /**
   * Get the cache directory path
   */
  getCacheDir(): string {
    return this.cacheDir;
  }

  /**
   * Load or create config file
   */
  private loadOrCreateConfig(): ICacheConfig {
    if (this.fs.exists(this.configPath)) {
      try {
        const content = this.fs.readFile(this.configPath);
        return JSON.parse(content) as ICacheConfig;
      } catch {
        // Config is corrupted, create new one
      }
    }

    // Create new config
    const config: ICacheConfig = {
      version: CACHE_VERSION,
      created: Date.now(),
      transpilerVersion: TRANSPILER_VERSION,
      structStateShape: STRUCT_STATE_SHAPE,
    };

    this.saveConfig(config);
    return config;
  }

  /**
   * Save config file
   */
  private saveConfig(config?: ICacheConfig): void {
    const configToSave = config ?? {
      version: CACHE_VERSION,
      created: Date.now(),
      transpilerVersion: TRANSPILER_VERSION,
      structStateShape: STRUCT_STATE_SHAPE,
    };

    this.fs.writeFile(this.configPath, JSON.stringify(configToSave, null, 2));
  }

  /**
   * Check if cache should be invalidated based on version
   */
  private shouldInvalidateCache(config: ICacheConfig): boolean {
    // Invalidate if cache version changed
    if (config.version !== CACHE_VERSION) {
      return true;
    }

    // Invalidate if transpiler version changed
    if (config.transpilerVersion !== TRANSPILER_VERSION) {
      return true;
    }

    // Issue #1225: struct state gained or lost a field, so every stored entry
    // describes a shape this build does not have.
    if (config.structStateShape !== STRUCT_STATE_SHAPE) {
      return true;
    }

    return false;
  }

  /**
   * Drop cache entries written in an older entry shape.
   *
   * Issue #1225: this used to rebuild a pre-`cacheKey` entry from whatever
   * fields it happened to have, which produced an entry missing struct state
   * and typed symbols -- a half-written cache of exactly the kind this issue
   * is about. Re-parsing the file costs milliseconds; trusting a partial entry
   * costs a wrong header.
   */
  private discardOutdatedEntries(): void {
    if (!this.cache) return;

    const allEntries = this.cache.all();
    for (const [key, value] of Object.entries(allEntries)) {
      const data = value as Record<string, unknown>;

      if (typeof data.cacheKey === "string") {
        continue;
      }

      this.cache.removeKey(key);
      this.dirty = true;
    }
  }
}

export default CacheManager;
