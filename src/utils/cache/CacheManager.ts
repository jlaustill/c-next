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
// ADR-055 Phase 7: ISymbol removed - using ISerializedSymbol directly
import IStructFieldInfo from "../../transpiler/types/symbols/IStructFieldInfo";
import SymbolTable from "../../transpiler/logic/symbols/SymbolTable";
import ICacheConfig from "../../transpiler/types/ICacheConfig";
import ICachedFileEntry from "../../transpiler/types/ICachedFileEntry";
import ISerializedSymbol from "../../transpiler/types/ISerializedSymbol";
import IFileSystem from "../../transpiler/types/IFileSystem";
import NodeFileSystem from "../../transpiler/NodeFileSystem";
import packageJson from "../../../package.json" with { type: "json" };
import TAnySymbol from "../../transpiler/types/symbols/TAnySymbol";
import TypeResolver from "../TypeResolver";
import ESourceLanguage from "../types/ESourceLanguage";

/** Default file system instance (singleton for performance) */
const defaultFs = NodeFileSystem.instance;

/** Current cache format version - increment when serialization format changes */
const CACHE_VERSION = 5; // Issue #948: Add opaqueTypes to cache

const TRANSPILER_VERSION = packageJson.version;

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

    // Migrate old entries if needed
    this.migrateOldEntries();
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
   * Get cached symbols and struct fields for a file
   * ADR-055 Phase 7: Returns ISerializedSymbol[] directly (no ISymbol intermediate)
   */
  getSymbols(filePath: string): {
    symbols: ISerializedSymbol[];
    structFields: Map<string, Map<string, IStructFieldInfo>>;
    needsStructKeyword: string[];
    enumBitWidth: Map<string, number>;
    opaqueTypes: string[];
  } | null {
    if (!this.cache) return null;

    const entry = this.cache.getKey(filePath);
    if (!entry) {
      return null;
    }
    const cachedEntry = entry as ICachedFileEntry;

    // ADR-055 Phase 7: Return serialized symbols directly
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
      opaqueTypes: cachedEntry.opaqueTypes ?? [],
    };
  }

  /**
   * Store symbols and struct fields for a file
   * ADR-055 Phase 7: Takes ISerializedSymbol[] directly
   */
  setSymbols(
    filePath: string,
    symbols: ISerializedSymbol[],
    structFields: Map<string, Map<string, IStructFieldInfo>>,
    needsStructKeyword?: string[],
    enumBitWidth?: Map<string, number>,
    opaqueTypes?: string[],
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

    // ADR-055 Phase 7: symbols are already serialized
    const serializedSymbols = symbols;

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
    if (enumBitWidth) {
      for (const [enumName, width] of enumBitWidth) {
        serializedEnumBitWidth[enumName] = width;
      }
    }

    // Create entry
    const entry: ICachedFileEntry = {
      filePath,
      cacheKey,
      symbols: serializedSymbols,
      structFields: serializedFields,
      needsStructKeyword,
      enumBitWidth: serializedEnumBitWidth,
      opaqueTypes,
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
   */
  setSymbolsFromTable(filePath: string, symbolTable: SymbolTable): void {
    // ADR-055 Phase 7: Serialize TAnySymbol directly to ISerializedSymbol
    const typedSymbols = symbolTable.getSymbolsByFile(filePath);
    const symbols = typedSymbols.map((s) => this.serializeTypedSymbol(s));

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

    // Issue #948: Extract opaque types (forward-declared structs)
    const opaqueTypes = symbolTable.getAllOpaqueTypes();

    // Delegate to existing setSymbols method
    this.setSymbols(
      filePath,
      symbols,
      structFields,
      needsStructKeyword,
      enumBitWidth,
      opaqueTypes,
    );
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

    return false;
  }

  /**
   * Migrate old cache entries from mtime-based to cacheKey-based format
   */
  private migrateOldEntries(): void {
    if (!this.cache) return;

    const allEntries = this.cache.all();
    for (const [key, value] of Object.entries(allEntries)) {
      const data = value as Record<string, unknown>;

      // Already has cacheKey - no migration needed
      if (typeof data.cacheKey === "string") {
        continue;
      }

      // Migration: convert old mtime to cacheKey format
      if (typeof data.mtime === "number") {
        const migratedEntry: ICachedFileEntry = {
          filePath: data.filePath as string,
          cacheKey: `mtime:${data.mtime}`,
          symbols: data.symbols as ISerializedSymbol[],
          structFields: data.structFields as Record<
            string,
            Record<string, IStructFieldInfo>
          >,
          needsStructKeyword: data.needsStructKeyword as string[] | undefined,
          enumBitWidth: data.enumBitWidth as Record<string, number> | undefined,
        };
        this.cache.setKey(key, migratedEntry);
        this.dirty = true;
      } else {
        // Invalid entry - remove it
        this.cache.removeKey(key);
        this.dirty = true;
      }
    }
  }

  /**
   * ADR-055 Phase 7: Serialize TAnySymbol directly to ISerializedSymbol.
   * No intermediate ISymbol format.
   */
  private serializeTypedSymbol(symbol: TAnySymbol): ISerializedSymbol {
    const serialized: ISerializedSymbol = {
      name: symbol.name,
      kind: symbol.kind,
      sourceFile: symbol.sourceFile,
      sourceLine: symbol.sourceLine,
      sourceLanguage: symbol.sourceLanguage,
      isExported: symbol.isExported,
    };

    this.addTypeFieldToSerialized(symbol, serialized);
    this.addVariableFieldsToSerialized(symbol, serialized);
    this.addFunctionFieldsToSerialized(symbol, serialized);

    return serialized;
  }

  /**
   * Add type field to ISerializedSymbol, converting TType to string for C-Next symbols.
   */
  private addTypeFieldToSerialized(
    symbol: TAnySymbol,
    serialized: ISerializedSymbol,
  ): void {
    if (!("type" in symbol) || symbol.type === undefined) {
      return;
    }
    const isCNextWithTType =
      symbol.sourceLanguage === ESourceLanguage.CNext &&
      typeof symbol.type !== "string";
    serialized.type = isCNextWithTType
      ? TypeResolver.getTypeName(symbol.type)
      : (symbol.type as string);
  }

  /**
   * Add variable-specific fields to ISerializedSymbol.
   */
  private addVariableFieldsToSerialized(
    symbol: TAnySymbol,
    serialized: ISerializedSymbol,
  ): void {
    if (symbol.kind !== "variable") {
      return;
    }
    if ("isConst" in symbol && symbol.isConst !== undefined) {
      serialized.isConst = symbol.isConst;
    }
    if ("isAtomic" in symbol && symbol.isAtomic !== undefined) {
      serialized.isAtomic = symbol.isAtomic;
    }
    if ("isArray" in symbol && symbol.isArray !== undefined) {
      serialized.isArray = symbol.isArray;
    }
    if ("arrayDimensions" in symbol && symbol.arrayDimensions) {
      serialized.arrayDimensions = symbol.arrayDimensions.map(String);
    }
    if ("initialValue" in symbol && symbol.initialValue !== undefined) {
      serialized.initialValue = symbol.initialValue;
    }
  }

  /**
   * Add function-specific fields to ISerializedSymbol.
   */
  private addFunctionFieldsToSerialized(
    symbol: TAnySymbol,
    serialized: ISerializedSymbol,
  ): void {
    if (symbol.kind !== "function") {
      return;
    }
    if ("returnType" in symbol && symbol.returnType !== undefined) {
      serialized.type = TypeResolver.getTypeName(symbol.returnType);
    }
    if ("parameters" in symbol && symbol.parameters) {
      serialized.parameters = symbol.parameters.map((p) => ({
        name: p.name,
        type:
          typeof p.type === "string"
            ? p.type
            : TypeResolver.getTypeName(p.type),
        isConst: p.isConst,
        isArray: p.isArray,
      }));
    }
  }
}

export default CacheManager;
