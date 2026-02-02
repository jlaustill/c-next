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

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { FlatCache, create as createFlatCache } from "flat-cache";
import CacheKeyGenerator from "./CacheKeyGenerator";
import ISymbol from "../types/ISymbol";
import IStructFieldInfo from "../../transpiler/logic/symbols/types/IStructFieldInfo";
import SymbolTable from "../../transpiler/logic/symbols/SymbolTable";
import ICacheConfig from "../../transpiler/types/ICacheConfig";
import ICachedFileEntry from "../../transpiler/types/ICachedFileEntry";
import ISerializedSymbol from "../../transpiler/types/ISerializedSymbol";

/** Current cache format version - increment when serialization format changes */
const CACHE_VERSION = 3; // ADR-055 Phase 4: cacheKey replaces mtime

// Read version from package.json
// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJson = require("../../../package.json");
const TRANSPILER_VERSION = packageJson.version as string;

/**
 * Manages symbol cache for faster incremental builds
 */
class CacheManager {
  private readonly projectRoot: string;
  private readonly cacheDir: string;
  private readonly cacheSubdir: string;
  private readonly configPath: string;

  /** flat-cache instance for symbol storage */
  private cache: FlatCache | null = null;

  /** Whether the cache has been modified and needs flushing */
  private dirty = false;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.cacheDir = join(projectRoot, ".cnx");
    this.cacheSubdir = join(this.cacheDir, "cache");
    this.configPath = join(this.cacheDir, "config.json");
  }

  /**
   * Initialize the cache directory and load existing cache
   */
  async initialize(): Promise<void> {
    // Create .cnx directory structure
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }

    if (!existsSync(this.cacheSubdir)) {
      mkdirSync(this.cacheSubdir, { recursive: true });
    }

    // Load or create config
    const config = this.loadOrCreateConfig();

    // Check if cache should be invalidated
    if (this.shouldInvalidateCache(config)) {
      // Remove old cache file if it exists
      const oldCacheFile = join(this.cacheSubdir, "symbols");
      if (existsSync(oldCacheFile)) {
        try {
          unlinkSync(oldCacheFile);
        } catch {
          // Ignore if we can't delete
        }
      }
      // Create fresh cache
      this.cache = createFlatCache({ cacheId: "symbols", cacheDir: this.cacheSubdir });
      this.saveConfig();
      return;
    }

    // Load existing cache - create also loads if file exists
    this.cache = createFlatCache({ cacheId: "symbols", cacheDir: this.cacheSubdir });

    // Migrate old entries if needed
    this.migrateOldEntries();
  }

  /**
   * Check if a file's cache is valid (not modified since cached)
   */
  isValid(filePath: string): boolean {
    if (!this.cache) return false;

    const entry = this.cache.getKey(filePath) as ICachedFileEntry | undefined;
    if (!entry) {
      return false;
    }

    return CacheKeyGenerator.isValid(filePath, entry.cacheKey);
  }

  /**
   * Get cached symbols and struct fields for a file
   */
  getSymbols(filePath: string): {
    symbols: ISymbol[];
    structFields: Map<string, Map<string, IStructFieldInfo>>;
    needsStructKeyword: string[];
    enumBitWidth: Map<string, number>;
  } | null {
    if (!this.cache) return null;

    const entry = this.cache.getKey(filePath) as ICachedFileEntry | undefined;
    if (!entry) {
      return null;
    }

    // Deserialize symbols
    const symbols = entry.symbols.map((s) => this.deserializeSymbol(s));

    // Convert struct fields from plain objects to Maps
    const structFields = new Map<string, Map<string, IStructFieldInfo>>();
    for (const [structName, fields] of Object.entries(entry.structFields)) {
      const fieldMap = new Map<string, IStructFieldInfo>();
      for (const [fieldName, fieldInfo] of Object.entries(fields)) {
        fieldMap.set(fieldName, fieldInfo);
      }
      structFields.set(structName, fieldMap);
    }

    // Issue #208: Convert enum bit widths from plain object to Map
    const enumBitWidth = new Map<string, number>();
    if (entry.enumBitWidth) {
      for (const [enumName, width] of Object.entries(entry.enumBitWidth)) {
        enumBitWidth.set(enumName, width);
      }
    }

    return {
      symbols,
      structFields,
      needsStructKeyword: entry.needsStructKeyword ?? [],
      enumBitWidth,
    };
  }

  /**
   * Store symbols and struct fields for a file
   */
  setSymbols(
    filePath: string,
    symbols: ISymbol[],
    structFields: Map<string, Map<string, IStructFieldInfo>>,
    needsStructKeyword?: string[],
    enumBitWidth?: Map<string, number>,
  ): void {
    if (!this.cache) return;

    // Generate cache key for current file state
    let cacheKey: string;
    try {
      cacheKey = CacheKeyGenerator.generate(filePath);
    } catch {
      // If we can't stat the file, don't cache it
      return;
    }

    // Serialize symbols
    const serializedSymbols = symbols.map((s) => this.serializeSymbol(s));

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
    // Extract symbols for this file
    const symbols = symbolTable.getSymbolsByFile(filePath);

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

    // Delegate to existing setSymbols method
    this.setSymbols(
      filePath,
      symbols,
      structFields,
      needsStructKeyword,
      enumBitWidth,
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
    if (!this.cache) {
      // Create fresh cache if not initialized
      this.cache = createFlatCache({ cacheId: "symbols", cacheDir: this.cacheSubdir });
    } else {
      // Clear all entries
      this.cache.clear();
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
    if (existsSync(this.configPath)) {
      try {
        const content = readFileSync(this.configPath, "utf-8");
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

    writeFileSync(
      this.configPath,
      JSON.stringify(configToSave, null, 2),
      "utf-8",
    );
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
   * Serialize an ISymbol to JSON-safe format
   */
  private serializeSymbol(symbol: ISymbol): ISerializedSymbol {
    const serialized: ISerializedSymbol = {
      name: symbol.name,
      kind: symbol.kind, // Already a string from enum
      sourceFile: symbol.sourceFile,
      sourceLine: symbol.sourceLine,
      sourceLanguage: symbol.sourceLanguage, // Already a string from enum
      isExported: symbol.isExported,
    };

    // Add optional fields only if present
    if (symbol.type !== undefined) serialized.type = symbol.type;
    if (symbol.isDeclaration !== undefined)
      serialized.isDeclaration = symbol.isDeclaration;
    if (symbol.signature !== undefined) serialized.signature = symbol.signature;
    if (symbol.parent !== undefined) serialized.parent = symbol.parent;
    if (symbol.accessModifier !== undefined)
      serialized.accessModifier = symbol.accessModifier;
    if (symbol.size !== undefined) serialized.size = symbol.size;
    if (symbol.parameters !== undefined)
      serialized.parameters = symbol.parameters;

    return serialized;
  }

  /**
   * Deserialize a symbol from JSON format back to ISymbol
   */
  private deserializeSymbol(serialized: ISerializedSymbol): ISymbol {
    const symbol: ISymbol = {
      name: serialized.name,
      kind: serialized.kind as ISymbol["kind"], // Cast string back to enum
      sourceFile: serialized.sourceFile,
      sourceLine: serialized.sourceLine,
      sourceLanguage: serialized.sourceLanguage as ISymbol["sourceLanguage"],
      isExported: serialized.isExported,
    };

    // Add optional fields only if present
    if (serialized.type !== undefined) symbol.type = serialized.type;
    if (serialized.isDeclaration !== undefined)
      symbol.isDeclaration = serialized.isDeclaration;
    if (serialized.signature !== undefined)
      symbol.signature = serialized.signature;
    if (serialized.parent !== undefined) symbol.parent = serialized.parent;
    if (serialized.accessModifier !== undefined)
      symbol.accessModifier = serialized.accessModifier;
    if (serialized.size !== undefined) symbol.size = serialized.size;
    if (serialized.parameters !== undefined)
      symbol.parameters = serialized.parameters;

    return symbol;
  }
}

export default CacheManager;
