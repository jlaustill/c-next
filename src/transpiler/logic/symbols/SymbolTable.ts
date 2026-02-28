/**
 * Unified Symbol Table
 * Stores symbols from all source languages and detects conflicts
 *
 * ADR-055 Phase 7: Fully typed symbol storage using discriminated unions.
 * - TSymbol: C-Next symbols (rich type system with TType)
 * - TCSymbol: C header symbols (string types)
 * - TCppSymbol: C++ header symbols (string types)
 */

import { produce, enableMapSet } from "immer";
import ESourceLanguage from "../../../utils/types/ESourceLanguage";
import LiteralUtils from "../../../utils/LiteralUtils";
import IConflict from "../../types/IConflict";
import IStructFieldInfo from "../../types/symbols/IStructFieldInfo";
import TSymbol from "../../types/symbols/TSymbol";
import TCSymbol from "../../types/symbols/c/TCSymbol";
import TCppSymbol from "../../types/symbols/cpp/TCppSymbol";
import TAnySymbol from "../../types/symbols/TAnySymbol";
import IStructSymbol from "../../types/symbols/IStructSymbol";
import IEnumSymbol from "../../types/symbols/IEnumSymbol";
import IFunctionSymbol from "../../types/symbols/IFunctionSymbol";
import IVariableSymbol from "../../types/symbols/IVariableSymbol";
import TypeResolver from "../../../utils/TypeResolver";
import SymbolNameUtils from "./cnext/utils/SymbolNameUtils";

// Enable immer support for Map and Set (must be called once at module scope)
enableMapSet();

/**
 * Issue #958: Immutable struct symbol state managed via immer produce().
 * All mutations are additive-only — no unmark/delete operations.
 * Resolution (e.g., "is this type truly opaque?") happens at query time.
 */
interface IStructSymbolState {
  /** Typedef names declared with forward-declared structs (additive only) */
  opaqueTypes: Set<string>;
  /** ALL typedef struct types from C headers: name → sourceFile (additive only) */
  typedefStructTypes: Map<string, string>;
  /** Struct tag → typedef name (e.g., "_widget_t" → "widget_t") */
  structTagAliases: Map<string, string>;
  /** Typedef name → struct tag (reverse of structTagAliases) */
  typedefToTag: Map<string, string>;
  /** Struct tags that have full definitions (bodies) */
  structTagsWithBodies: Set<string>;
}

/** Create a fresh initial struct symbol state */
function createInitialStructState(): IStructSymbolState {
  return {
    opaqueTypes: new Set(),
    typedefStructTypes: new Map(),
    structTagAliases: new Map(),
    typedefToTag: new Map(),
    structTagsWithBodies: new Set(),
  };
}

/**
 * Central symbol table for cross-language interoperability
 *
 * Per user requirement: Symbol conflicts between C-Next and C/C++ are ERRORS.
 * - ERROR: Same symbol defined in C-Next and C/C++
 * - OK: Multiple `extern` declarations in C (declaration, not definition)
 * - OK: Function overloads in C++ (different signatures)
 */
class SymbolTable {
  // ========================================================================
  // C-Next Symbol Storage (TSymbol)
  // ========================================================================

  /** All C-Next TSymbols indexed by name */
  private readonly tSymbols: Map<string, TSymbol[]> = new Map();

  /** C-Next TSymbols indexed by source file */
  private readonly tSymbolsByFile: Map<string, TSymbol[]> = new Map();

  // ========================================================================
  // C Symbol Storage (TCSymbol)
  // ========================================================================

  /** All C symbols indexed by name */
  private readonly cSymbols: Map<string, TCSymbol[]> = new Map();

  /** C symbols indexed by source file */
  private readonly cSymbolsByFile: Map<string, TCSymbol[]> = new Map();

  // ========================================================================
  // C++ Symbol Storage (TCppSymbol)
  // ========================================================================

  /** All C++ symbols indexed by name */
  private readonly cppSymbols: Map<string, TCppSymbol[]> = new Map();

  /** C++ symbols indexed by source file */
  private readonly cppSymbolsByFile: Map<string, TCppSymbol[]> = new Map();

  // ========================================================================
  // Auxiliary Data (shared across languages)
  // ========================================================================

  /** Struct field information: struct name -> (field name -> field info) */
  private readonly structFields: Map<string, Map<string, IStructFieldInfo>> =
    new Map();

  /**
   * Issue #196 Bug 3: Track C struct names that need the 'struct' keyword
   * These are structs defined as 'struct Name { ... }' without typedef
   * In C, they must be referred to as 'struct Name', not just 'Name'
   */
  private readonly needsStructKeyword: Set<string> = new Set();

  /**
   * Issue #958: Immutable struct symbol state — additive only, query-time resolution.
   * Replaces separate opaqueTypes, typedefStructTypes, structTagAliases fields.
   */
  private structState: IStructSymbolState = createInitialStructState();

  /**
   * Issue #208: Track enum backing type bit widths
   * C++14 typed enums: enum Name : uint8_t { ... } have explicit bit widths
   */
  private readonly enumBitWidth: Map<string, number> = new Map();

  // ========================================================================
  // C-Next Symbol Methods (TSymbol)
  // ========================================================================

  /**
   * Add a C-Next TSymbol to the table
   */
  addTSymbol(symbol: TSymbol): void {
    // Add to name index
    const existing = this.tSymbols.get(symbol.name);
    if (existing) {
      existing.push(symbol);
    } else {
      this.tSymbols.set(symbol.name, [symbol]);
    }

    // Add to file index
    const fileSymbols = this.tSymbolsByFile.get(symbol.sourceFile);
    if (fileSymbols) {
      fileSymbols.push(symbol);
    } else {
      this.tSymbolsByFile.set(symbol.sourceFile, [symbol]);
    }

    // Auto-register struct fields for TypeResolver.getMemberTypeInfo()
    if (symbol.kind === "struct") {
      this.registerStructFields(symbol);
    }
  }

  /**
   * Register struct fields in structFields map for cross-file type resolution.
   * Called automatically when adding struct symbols.
   * Issue #981: Now preserves string dimensions (macro names) for proper array detection.
   */
  private registerStructFields(struct: IStructSymbol): void {
    const cName = SymbolNameUtils.getTranspiledCName(struct);

    for (const [fieldName, fieldInfo] of struct.fields) {
      // Convert TType to string for structFields map
      const typeString = TypeResolver.getTypeName(fieldInfo.type);

      this.addStructField(
        cName,
        fieldName,
        typeString,
        fieldInfo.dimensions && fieldInfo.dimensions.length > 0
          ? fieldInfo.dimensions
          : undefined,
      );
    }
  }

  /**
   * Add multiple C-Next TSymbols at once
   */
  addTSymbols(symbols: TSymbol[]): void {
    for (const symbol of symbols) {
      this.addTSymbol(symbol);
    }
  }

  /**
   * Get a TSymbol by name (returns first match, or undefined)
   */
  getTSymbol(name: string): TSymbol | undefined {
    const symbols = this.tSymbols.get(name);
    return symbols?.[0];
  }

  /**
   * Get all TSymbols with a given name (for overload detection)
   */
  getTOverloads(name: string): TSymbol[] {
    return this.tSymbols.get(name) ?? [];
  }

  /**
   * Get TSymbols by source file
   */
  getTSymbolsByFile(file: string): TSymbol[] {
    return this.tSymbolsByFile.get(file) ?? [];
  }

  /**
   * Get all TSymbols
   */
  getAllTSymbols(): TSymbol[] {
    const result: TSymbol[] = [];
    for (const symbols of this.tSymbols.values()) {
      result.push(...symbols);
    }
    return result;
  }

  /**
   * Get all struct symbols (type-safe filtering)
   */
  getStructSymbols(): IStructSymbol[] {
    return this.getAllTSymbols().filter(
      (s): s is IStructSymbol => s.kind === "struct",
    );
  }

  /**
   * Get all enum symbols (type-safe filtering)
   */
  getEnumSymbols(): IEnumSymbol[] {
    return this.getAllTSymbols().filter(
      (s): s is IEnumSymbol => s.kind === "enum",
    );
  }

  /**
   * Get all function symbols (type-safe filtering)
   */
  getFunctionSymbols(): IFunctionSymbol[] {
    return this.getAllTSymbols().filter(
      (s): s is IFunctionSymbol => s.kind === "function",
    );
  }

  /**
   * Get all variable symbols (type-safe filtering)
   */
  getVariableSymbols(): IVariableSymbol[] {
    return this.getAllTSymbols().filter(
      (s): s is IVariableSymbol => s.kind === "variable",
    );
  }

  /**
   * Get struct field type directly from TSymbol storage.
   * This method queries IStructSymbol.fields directly, eliminating the need
   * for the separate structFields Map for C-Next symbols.
   *
   * @param structName Name of the struct
   * @param fieldName Name of the field
   * @returns Field type string or undefined if not found
   */
  getTStructFieldType(
    structName: string,
    fieldName: string,
  ): string | undefined {
    const struct = this.getTOverloads(structName).find(
      (s): s is IStructSymbol => s.kind === "struct",
    );
    if (!struct) {
      return undefined;
    }
    const field = struct.fields.get(fieldName);
    return field ? TypeResolver.getTypeName(field.type) : undefined;
  }

  /**
   * Check if a TSymbol exists by name
   */
  hasTSymbol(name: string): boolean {
    return this.tSymbols.has(name);
  }

  /**
   * Get TSymbol count
   */
  getTSize(): number {
    let count = 0;
    for (const symbols of this.tSymbols.values()) {
      count += symbols.length;
    }
    return count;
  }

  // ========================================================================
  // C Symbol Methods (TCSymbol)
  // ========================================================================

  /**
   * Add a C symbol to the table
   * Issue #981: Also register struct fields for type resolution
   */
  addCSymbol(symbol: TCSymbol): void {
    // Add to name index
    const existing = this.cSymbols.get(symbol.name);
    if (existing) {
      existing.push(symbol);
    } else {
      this.cSymbols.set(symbol.name, [symbol]);
    }

    // Add to file index
    const fileSymbols = this.cSymbolsByFile.get(symbol.sourceFile);
    if (fileSymbols) {
      fileSymbols.push(symbol);
    } else {
      this.cSymbolsByFile.set(symbol.sourceFile, [symbol]);
    }

    // Issue #981: Register struct fields for getMemberTypeInfo() lookups
    if (symbol.kind === "struct" && symbol.fields) {
      this.registerCStructFields(symbol.name, symbol.fields);
    }
  }

  /**
   * Register C struct fields in structFields map for cross-file type resolution.
   * Issue #981: Required for macro-sized array field detection on local struct variables.
   */
  private registerCStructFields(
    structName: string,
    fields: ReadonlyMap<
      string,
      import("../../types/symbols/c/ICFieldInfo").default
    >,
  ): void {
    for (const [fieldName, fieldInfo] of fields) {
      this.addStructField(
        structName,
        fieldName,
        fieldInfo.type,
        fieldInfo.arrayDimensions,
      );
    }
  }

  /**
   * Add multiple C symbols at once
   */
  addCSymbols(symbols: TCSymbol[]): void {
    for (const symbol of symbols) {
      this.addCSymbol(symbol);
    }
  }

  /**
   * Get a C symbol by name (returns first match, or undefined)
   */
  getCSymbol(name: string): TCSymbol | undefined {
    const symbols = this.cSymbols.get(name);
    return symbols?.[0];
  }

  /**
   * Get all C symbols with a given name
   */
  getCOverloads(name: string): TCSymbol[] {
    return this.cSymbols.get(name) ?? [];
  }

  /**
   * Get C symbols by source file
   */
  getCSymbolsByFile(file: string): TCSymbol[] {
    return this.cSymbolsByFile.get(file) ?? [];
  }

  /**
   * Get all C symbols
   */
  getAllCSymbols(): TCSymbol[] {
    const result: TCSymbol[] = [];
    for (const symbols of this.cSymbols.values()) {
      result.push(...symbols);
    }
    return result;
  }

  // ========================================================================
  // C++ Symbol Methods (TCppSymbol)
  // ========================================================================

  /**
   * Add a C++ symbol to the table
   */
  addCppSymbol(symbol: TCppSymbol): void {
    // Add to name index
    const existing = this.cppSymbols.get(symbol.name);
    if (existing) {
      existing.push(symbol);
    } else {
      this.cppSymbols.set(symbol.name, [symbol]);
    }

    // Add to file index
    const fileSymbols = this.cppSymbolsByFile.get(symbol.sourceFile);
    if (fileSymbols) {
      fileSymbols.push(symbol);
    } else {
      this.cppSymbolsByFile.set(symbol.sourceFile, [symbol]);
    }
  }

  /**
   * Add multiple C++ symbols at once
   */
  addCppSymbols(symbols: TCppSymbol[]): void {
    for (const symbol of symbols) {
      this.addCppSymbol(symbol);
    }
  }

  /**
   * Get a C++ symbol by name (returns first match, or undefined)
   */
  getCppSymbol(name: string): TCppSymbol | undefined {
    const symbols = this.cppSymbols.get(name);
    return symbols?.[0];
  }

  /**
   * Get all C++ symbols with a given name
   */
  getCppOverloads(name: string): TCppSymbol[] {
    return this.cppSymbols.get(name) ?? [];
  }

  /**
   * Get C++ symbols by source file
   */
  getCppSymbolsByFile(file: string): TCppSymbol[] {
    return this.cppSymbolsByFile.get(file) ?? [];
  }

  /**
   * Get all C++ symbols
   */
  getAllCppSymbols(): TCppSymbol[] {
    const result: TCppSymbol[] = [];
    for (const symbols of this.cppSymbols.values()) {
      result.push(...symbols);
    }
    return result;
  }

  // ========================================================================
  // Cross-Language Methods
  // ========================================================================

  /**
   * Get all symbols across all languages
   */
  getAllSymbols(): TAnySymbol[] {
    return [
      ...this.getAllTSymbols(),
      ...this.getAllCSymbols(),
      ...this.getAllCppSymbols(),
    ];
  }

  /**
   * Get first symbol matching a name across all languages.
   * Searches TSymbol, then C, then C++ collections.
   * Used by ISymbolLookup interface for constructor detection.
   */
  getSymbol(name: string): TAnySymbol | undefined {
    return (
      this.getTSymbol(name) ?? this.getCSymbol(name) ?? this.getCppSymbol(name)
    );
  }

  /**
   * Get all overloads for a name across all languages
   */
  getOverloads(name: string): TAnySymbol[] {
    return [
      ...this.getTOverloads(name),
      ...this.getCOverloads(name),
      ...this.getCppOverloads(name),
    ];
  }

  /**
   * Get symbols by source file across all languages
   */
  getSymbolsByFile(file: string): TAnySymbol[] {
    return [
      ...this.getTSymbolsByFile(file),
      ...this.getCSymbolsByFile(file),
      ...this.getCppSymbolsByFile(file),
    ];
  }

  /**
   * Get symbols by source language
   */
  getSymbolsByLanguage(lang: ESourceLanguage): TAnySymbol[] {
    switch (lang) {
      case ESourceLanguage.CNext:
        return this.getAllTSymbols();
      case ESourceLanguage.C:
        return this.getAllCSymbols();
      case ESourceLanguage.Cpp:
        return this.getAllCppSymbols();
    }
  }

  /**
   * Check if a symbol exists in any language
   */
  hasSymbol(name: string): boolean {
    return (
      this.tSymbols.has(name) ||
      this.cSymbols.has(name) ||
      this.cppSymbols.has(name)
    );
  }

  /**
   * Get total symbol count
   */
  get size(): number {
    return this.getTSize() + this.getCSize() + this.getCppSize();
  }

  /**
   * Get C symbol count
   */
  getCSize(): number {
    let count = 0;
    for (const symbols of this.cSymbols.values()) {
      count += symbols.length;
    }
    return count;
  }

  /**
   * Get C++ symbol count
   */
  getCppSize(): number {
    let count = 0;
    for (const symbols of this.cppSymbols.values()) {
      count += symbols.length;
    }
    return count;
  }

  // ========================================================================
  // Conflict Detection
  // ========================================================================

  /**
   * Check if a symbol has conflicts
   */
  hasConflict(name: string): boolean {
    const allSymbols = this.getOverloads(name);
    if (allSymbols.length <= 1) {
      return false;
    }

    return this.detectConflict(allSymbols) !== null;
  }

  /**
   * Get all conflicts in the symbol table
   * Per user requirement: Strict errors for cross-language conflicts
   */
  getConflicts(): IConflict[] {
    const conflicts: IConflict[] = [];
    const allNames = new Set<string>();

    // Collect all symbol names from all languages
    for (const name of this.tSymbols.keys()) allNames.add(name);
    for (const name of this.cSymbols.keys()) allNames.add(name);
    for (const name of this.cppSymbols.keys()) allNames.add(name);

    for (const name of allNames) {
      const symbols = this.getOverloads(name);
      if (symbols.length <= 1) continue;

      const conflict = this.detectConflict(symbols);
      if (conflict) {
        conflicts.push(conflict);
      }
    }

    return conflicts;
  }

  /**
   * Detect if a set of symbols with the same name represents a conflict
   */
  private detectConflict(symbols: TAnySymbol[]): IConflict | null {
    // Filter out pure declarations (extern in C) - they don't count as definitions
    const definitions = symbols.filter(
      (s) => !("isDeclaration" in s && s.isDeclaration),
    );

    if (definitions.length <= 1) {
      // 0 or 1 definitions = no conflict
      return null;
    }

    // Issue #221: Filter out function parameters from conflict detection
    // Function parameters have a parent but their name is NOT qualified with the parent prefix.
    const globalDefinitions = definitions.filter((def) => {
      // C-Next variables with scope need special handling
      if (
        def.sourceLanguage === ESourceLanguage.CNext &&
        def.kind === "variable"
      ) {
        // After sourceLanguage check, def is narrowed to TSymbol
        // After kind check, def is narrowed to IVariableSymbol
        // Global scope means no conflict filtering needed
        if (def.scope.name === "") return true;
        // Scope-level variables vs function parameters:
        // We can't easily distinguish here, so keep all for now
        return true;
      }
      // C/C++ symbols: check parent field
      if ("parent" in def && def.parent) {
        // Non-variable symbols with parents are kept
        if (def.kind !== "variable") return true;
        // Variables with parents might be function parameters - filter out
        return false;
      }
      return true;
    });

    if (globalDefinitions.length <= 1) {
      return null;
    }

    // Check for C++ function overloads (different signatures are OK)
    const cppFunctions = globalDefinitions.filter(
      (s) =>
        s.sourceLanguage === ESourceLanguage.Cpp &&
        s.kind === "function" &&
        "parameters" in s,
    );
    if (cppFunctions.length === globalDefinitions.length) {
      // All are C++ functions with signatures - check for unique signatures
      const signatures = cppFunctions.map((f) => {
        if ("parameters" in f && f.parameters) {
          const params = f.parameters as ReadonlyArray<{ type?: string }>;
          return params.map((p) => p.type ?? "").join(",");
        }
        return "";
      });
      const uniqueSignatures = new Set(signatures);
      if (uniqueSignatures.size === cppFunctions.length) {
        return null;
      }
    }

    // Check for cross-language conflict (C-Next vs C or C++)
    const cnextDefs = globalDefinitions.filter(
      (s) => s.sourceLanguage === ESourceLanguage.CNext,
    );
    const cDefs = globalDefinitions.filter(
      (s) => s.sourceLanguage === ESourceLanguage.C,
    );
    const cppDefs = globalDefinitions.filter(
      (s) => s.sourceLanguage === ESourceLanguage.Cpp,
    );

    // Issue #967: Only global-scope C-Next symbols can conflict with C/C++ symbols.
    // Scoped symbols (e.g., Touch.read) live in a namespace and don't compete
    // with C's global symbols (e.g., POSIX read()).
    const conflictingCnextDefs = cnextDefs.filter((s) => {
      const tSymbol = s as TSymbol;
      return tSymbol.scope.name === "";
    });

    if (
      conflictingCnextDefs.length > 0 &&
      (cDefs.length > 0 || cppDefs.length > 0)
    ) {
      const conflictingDefs = [...conflictingCnextDefs, ...cDefs, ...cppDefs];
      const locations = conflictingDefs.map(
        (s) =>
          `${s.sourceLanguage.toUpperCase()} (${s.sourceFile}:${s.sourceLine})`,
      );

      return {
        symbolName: conflictingDefs[0].name,
        definitions: conflictingDefs,
        severity: "error",
        message: `Symbol conflict: '${conflictingDefs[0].name}' is defined in multiple languages:\n  ${locations.join("\n  ")}\nRename the C-Next symbol to resolve.`,
      };
    }

    // Multiple definitions in same language (excluding overloads) = ERROR
    // Issue #817: Group by scope AND kind - symbols in different scopes don't conflict,
    // and symbols with different kinds (variable vs scope) don't conflict either
    if (cnextDefs.length > 1) {
      const byScopeAndKind = this.groupCNextSymbolsByScopeAndKind(cnextDefs);

      // Check each scope+kind group for conflicts (multiple symbols in same scope with same kind)
      for (const symbols of byScopeAndKind.values()) {
        if (symbols.length > 1) {
          const locations = symbols.map(
            (s) => `${s.sourceFile}:${s.sourceLine}`,
          );
          const scopeName = symbols[0].scope.name;
          const displayName =
            scopeName === ""
              ? symbols[0].name
              : `${scopeName}.${symbols[0].name}`;
          return {
            symbolName: displayName,
            definitions: symbols,
            severity: "error",
            message: `Symbol conflict: '${displayName}' is defined multiple times in C-Next:\n  ${locations.join("\n  ")}`,
          };
        }
      }
    }

    // Same symbol in C and C++ - typically OK (same symbol)
    if (cDefs.length > 0 && cppDefs.length > 0) {
      return null;
    }

    return null;
  }

  /**
   * Issue #817: Group C-Next symbols by scope name and kind.
   *
   * Symbols in different scopes don't conflict (Foo.enabled vs Bar.enabled
   * generate Foo_enabled and Bar_enabled). Symbols with different kinds also
   * don't conflict (variable LED vs scope LED are distinct).
   *
   * @param symbols C-Next symbols to group (must all be TSymbol)
   * @returns Map from "scopeName:kind" key to array of symbols
   */
  private groupCNextSymbolsByScopeAndKind(
    symbols: TAnySymbol[],
  ): Map<string, TSymbol[]> {
    const byScopeAndKind = new Map<string, TSymbol[]>();

    for (const def of symbols) {
      const tSymbol = def as TSymbol;
      const scopeName = tSymbol.scope.name;
      const key = `${scopeName}:${tSymbol.kind}`;
      const existing = byScopeAndKind.get(key);
      if (existing) {
        existing.push(tSymbol);
      } else {
        byScopeAndKind.set(key, [tSymbol]);
      }
    }

    return byScopeAndKind;
  }

  // ========================================================================
  // Struct Field Information
  // ========================================================================

  /**
   * Add struct field information.
   * Issue #981: Accept (number | string)[] for arrayDimensions to support macro-sized arrays.
   * @param structName Name of the struct
   * @param fieldName Name of the field
   * @param fieldType Type of the field (e.g., "uint32_t")
   * @param arrayDimensions Optional array dimensions - numbers for resolved, strings for macros
   */
  addStructField(
    structName: string,
    fieldName: string,
    fieldType: string,
    arrayDimensions?: readonly (number | string)[],
  ): void {
    let fields = this.structFields.get(structName);
    if (!fields) {
      fields = new Map();
      this.structFields.set(structName, fields);
    }

    // Copy to mutable array for storage
    fields.set(fieldName, {
      type: fieldType,
      arrayDimensions: arrayDimensions ? [...arrayDimensions] : undefined,
    });
  }

  /**
   * Get struct field type
   * @param structName Name of the struct
   * @param fieldName Name of the field
   * @returns Field type or undefined if not found
   */
  getStructFieldType(
    structName: string,
    fieldName: string,
  ): string | undefined {
    const fields = this.structFields.get(structName);
    return fields?.get(fieldName)?.type;
  }

  /**
   * Get struct field info (type and array dimensions)
   * @param structName Name of the struct
   * @param fieldName Name of the field
   * @returns Field info or undefined if not found
   */
  getStructFieldInfo(
    structName: string,
    fieldName: string,
  ): IStructFieldInfo | undefined {
    const fields = this.structFields.get(structName);
    return fields?.get(fieldName);
  }

  /**
   * Get all fields for a struct
   * @param structName Name of the struct
   * @returns Map of field names to field info, or undefined if struct not found
   */
  getStructFields(
    structName: string,
  ): Map<string, IStructFieldInfo> | undefined {
    return this.structFields.get(structName);
  }

  /**
   * Get struct field types as a simple map (fieldName -> typeName).
   * Used by code generation for nested struct initializers.
   * @param structName Name of the struct
   * @returns Map of field names to type strings, or undefined if struct not found
   */
  getStructFieldTypes(structName: string): Map<string, string> | undefined {
    const fields = this.structFields.get(structName);
    if (!fields) return undefined;

    const result = new Map<string, string>();
    for (const [fieldName, info] of fields) {
      result.set(fieldName, info.type);
    }
    return result;
  }

  /**
   * Get all struct fields for cache serialization
   * @returns Map of struct name -> (field name -> field info)
   */
  getAllStructFields(): Map<string, Map<string, IStructFieldInfo>> {
    return this.structFields;
  }

  /**
   * Restore struct fields from cache
   * Merges cached fields into the existing structFields map
   * @param fields Map of struct name -> (field name -> field info)
   */
  restoreStructFields(
    fields: Map<string, Map<string, IStructFieldInfo>>,
  ): void {
    for (const [structName, fieldMap] of fields) {
      let existingFields = this.structFields.get(structName);
      if (!existingFields) {
        existingFields = new Map();
        this.structFields.set(structName, existingFields);
      }

      for (const [fieldName, fieldInfo] of fieldMap) {
        existingFields.set(fieldName, fieldInfo);
      }
    }
  }

  /**
   * Get struct names defined in a specific source file
   * @param file Source file path
   * @returns Array of struct names defined in that file
   */
  getStructNamesByFile(file: string): string[] {
    const fileSymbols = this.getSymbolsByFile(file);
    const symbolNames = fileSymbols.map((s) => s.name);
    return symbolNames.filter((name) => this.structFields.has(name));
  }

  // ========================================================================
  // Struct Keyword Tracking
  // ========================================================================

  /**
   * Issue #196 Bug 3: Mark a struct as requiring 'struct' keyword in C
   * @param structName Name of the struct (e.g., "NamedPoint")
   */
  markNeedsStructKeyword(structName: string): void {
    this.needsStructKeyword.add(structName);
  }

  /**
   * Issue #196 Bug 3: Check if a struct requires 'struct' keyword in C
   * @param structName Name of the struct
   * @returns true if the struct was defined as 'struct Name { ... }' without typedef
   */
  checkNeedsStructKeyword(structName: string): boolean {
    return this.needsStructKeyword.has(structName);
  }

  /**
   * Issue #196 Bug 3: Get all struct names requiring 'struct' keyword
   * @returns Array of struct names
   */
  getAllNeedsStructKeyword(): string[] {
    return Array.from(this.needsStructKeyword);
  }

  /**
   * Issue #196 Bug 3: Restore needsStructKeyword from cache
   * @param structNames Array of struct names requiring 'struct' keyword
   */
  restoreNeedsStructKeyword(structNames: string[]): void {
    for (const name of structNames) {
      this.needsStructKeyword.add(name);
    }
  }

  // ========================================================================
  // Struct Symbol State (Issue #948, #958) — immer-managed, additive only
  // ========================================================================

  /**
   * Issue #948: Mark a typedef as aliasing an opaque (forward-declared) struct type.
   * @param typeName Typedef name (e.g., "widget_t")
   */
  markOpaqueType(typeName: string): void {
    this.structState = produce(this.structState, (draft) => {
      draft.opaqueTypes.add(typeName);
    });
  }

  /**
   * Issue #948/#958: Check if a typedef aliases a truly opaque struct type.
   * Query-time resolution: if the underlying struct tag has a body, it's not opaque.
   * @param typeName Typedef name
   * @returns true if the type is opaque (forward-declared with no body found)
   */
  isOpaqueType(typeName: string): boolean {
    if (!this.structState.opaqueTypes.has(typeName)) return false;
    // Resolve: if the underlying struct tag has a body, it's not truly opaque
    const tag = this.structState.typedefToTag.get(typeName);
    if (tag && this.structState.structTagsWithBodies.has(tag)) return false;
    return true;
  }

  /**
   * Issue #948: Get all opaque type names for cache serialization.
   * Returns the raw set — resolution happens at query time via isOpaqueType().
   * @returns Array of opaque typedef names
   */
  getAllOpaqueTypes(): string[] {
    return Array.from(this.structState.opaqueTypes);
  }

  /**
   * Issue #948: Restore opaque types from cache.
   * @param typeNames Array of opaque typedef names
   */
  restoreOpaqueTypes(typeNames: string[]): void {
    this.structState = produce(this.structState, (draft) => {
      for (const name of typeNames) {
        draft.opaqueTypes.add(name);
      }
    });
  }

  /**
   * Issue #948: Register a struct tag -> typedef name relationship.
   * Called when processing: typedef struct _foo foo_t;
   * Populates both forward (tag→typedef) and reverse (typedef→tag) maps.
   * @param structTag The struct tag name (e.g., "_foo")
   * @param typedefName The typedef alias name (e.g., "foo_t")
   */
  registerStructTagAlias(structTag: string, typedefName: string): void {
    this.structState = produce(this.structState, (draft) => {
      draft.structTagAliases.set(structTag, typedefName);
      draft.typedefToTag.set(typedefName, structTag);
    });
  }

  /**
   * Issue #948: Get the typedef alias for a struct tag, if any.
   * @param structTag The struct tag name
   * @returns The typedef alias name, or undefined if none registered
   */
  getStructTagAlias(structTag: string): string | undefined {
    return this.structState.structTagAliases.get(structTag);
  }

  /**
   * Issue #958: Record that a struct tag has a full definition (body).
   * Used by query-time resolution: opaque types with bodies are not truly opaque.
   * @param structTag The struct tag name (e.g., "_widget_t")
   */
  markStructTagHasBody(structTag: string): void {
    this.structState = produce(this.structState, (draft) => {
      draft.structTagsWithBodies.add(structTag);
    });
  }

  /**
   * Issue #958: Get all struct tags with bodies for cache serialization.
   * @returns Array of struct tag names
   */
  getAllStructTagsWithBodies(): string[] {
    return Array.from(this.structState.structTagsWithBodies);
  }

  /**
   * Issue #958: Restore struct tags with bodies from cache.
   * @param tags Array of struct tag names
   */
  restoreStructTagsWithBodies(tags: string[]): void {
    this.structState = produce(this.structState, (draft) => {
      for (const tag of tags) {
        draft.structTagsWithBodies.add(tag);
      }
    });
  }

  /**
   * Issue #958: Get all struct tag aliases for cache serialization.
   * @returns Array of [structTag, typedefName] pairs
   */
  getAllStructTagAliases(): Array<[string, string]> {
    return Array.from(this.structState.structTagAliases.entries());
  }

  /**
   * Issue #958: Restore struct tag aliases from cache.
   * @param entries Array of [structTag, typedefName] pairs
   */
  restoreStructTagAliases(entries: Array<[string, string]>): void {
    this.structState = produce(this.structState, (draft) => {
      for (const [tag, typedefName] of entries) {
        draft.structTagAliases.set(tag, typedefName);
        draft.typedefToTag.set(typedefName, tag);
      }
    });
  }

  // ========================================================================
  // Issue #958: Typedef Struct Type Tracking
  // ========================================================================

  /**
   * Issue #958: Mark a typedef as aliasing a struct type.
   * Records the source file. Additive only — never removed.
   * @param typedefName The typedef name (e.g., "widget_t")
   * @param sourceFile The file where the typedef was declared
   */
  markTypedefStructType(typedefName: string, sourceFile: string): void {
    this.structState = produce(this.structState, (draft) => {
      draft.typedefStructTypes.set(typedefName, sourceFile);
    });
  }

  /**
   * Issue #958: Check if a typedef aliases a struct type.
   * Used for scope variables, function parameters, and local variables
   * which should be pointers for C-header struct types.
   * @param typeName The type name to check
   * @returns true if this is a typedef'd struct type from C headers
   */
  isTypedefStructType(typeName: string): boolean {
    const result = this.structState.typedefStructTypes.has(typeName);
    return result;
  }

  /**
   * Issue #958: Get all typedef struct types for cache serialization.
   * @returns Map entries as [typeName, sourceFile] pairs
   */
  getAllTypedefStructTypes(): Array<[string, string]> {
    return Array.from(this.structState.typedefStructTypes.entries());
  }

  /**
   * Issue #958: Restore typedef struct types from cache.
   * @param entries Array of [typeName, sourceFile] pairs
   */
  restoreTypedefStructTypes(entries: Array<[string, string]>): void {
    this.structState = produce(this.structState, (draft) => {
      for (const [name, sourceFile] of entries) {
        draft.typedefStructTypes.set(name, sourceFile);
      }
    });
  }

  // ========================================================================
  // Enum Bit Width Tracking
  // ========================================================================

  /**
   * Issue #208: Add enum bit width for a typed enum
   * @param enumName Name of the enum (e.g., "EPressureType")
   * @param bitWidth Bit width from backing type (e.g., 8 for uint8_t)
   */
  addEnumBitWidth(enumName: string, bitWidth: number): void {
    this.enumBitWidth.set(enumName, bitWidth);
  }

  /**
   * Issue #208: Get enum bit width for a typed enum
   * @param enumName Name of the enum
   * @returns Bit width or undefined if not a typed enum
   */
  getEnumBitWidth(enumName: string): number | undefined {
    return this.enumBitWidth.get(enumName);
  }

  /**
   * Issue #208: Get all enum bit widths for cache serialization
   * @returns Map of enum name -> bit width
   */
  getAllEnumBitWidths(): Map<string, number> {
    return this.enumBitWidth;
  }

  /**
   * Issue #208: Restore enum bit widths from cache
   * @param bitWidths Map of enum name -> bit width
   */
  restoreEnumBitWidths(bitWidths: Map<string, number>): void {
    for (const [enumName, width] of bitWidths) {
      this.enumBitWidth.set(enumName, width);
    }
  }

  // ========================================================================
  // External Array Dimension Resolution
  // ========================================================================

  /**
   * Issue #461: Resolve external const array dimensions
   *
   * After all symbols are collected, scan for variable symbols with unresolved
   * array dimensions (stored as strings instead of numbers). For each unresolved
   * dimension, look up the const value in the symbol table and resolve it.
   *
   * This handles the case where array dimensions reference constants from
   * external .cnx files that were not available during initial symbol collection.
   */
  resolveExternalArrayDimensions(): void {
    const constValues = this.buildConstValuesMap();
    if (constValues.size === 0) {
      return;
    }
    this.resolveArrayDimensionsWithConstants(constValues);
  }

  /**
   * Build a map of const variable names to their integer values.
   */
  private buildConstValuesMap(): Map<string, number> {
    const constValues = new Map<string, number>();
    for (const symbol of this.getAllTSymbols()) {
      if (symbol.kind === "variable" && symbol.isConst) {
        // After kind check, symbol is narrowed to IVariableSymbol
        if (symbol.initialValue !== undefined) {
          const value = LiteralUtils.parseIntegerLiteral(symbol.initialValue);
          if (value !== undefined) {
            constValues.set(symbol.name, value);
          }
        }
      }
    }
    return constValues;
  }

  /**
   * Resolve string array dimensions using const values lookup.
   */
  private resolveArrayDimensionsWithConstants(
    constValues: Map<string, number>,
  ): void {
    for (const symbol of this.getAllTSymbols()) {
      if (
        symbol.kind === "variable" &&
        symbol.isArray &&
        symbol.arrayDimensions
      ) {
        // After kind check, symbol is narrowed to IVariableSymbol
        this.resolveVariableArrayDimensions(symbol, constValues);
      }
    }
  }

  /**
   * Resolve array dimensions for a single variable symbol.
   */
  private resolveVariableArrayDimensions(
    variable: IVariableSymbol,
    constValues: Map<string, number>,
  ): void {
    let modified = false;
    const resolvedDimensions = variable.arrayDimensions!.map((dim) => {
      if (typeof dim === "number") {
        return dim;
      }
      const constValue = constValues.get(dim);
      if (constValue !== undefined) {
        modified = true;
        return constValue;
      }
      return dim;
    });

    if (modified) {
      // Mutate in place - symbol is already in storage, cloning would require
      // updating all maps. The readonly typing prevents accidental mutations
      // elsewhere; this controlled mutation is intentional during resolution.
      (
        variable as unknown as { arrayDimensions: (number | string)[] }
      ).arrayDimensions = resolvedDimensions;
    }
  }

  // ========================================================================
  // Clear / Reset
  // ========================================================================

  /**
   * Clear all symbols
   */
  clear(): void {
    // C-Next
    this.tSymbols.clear();
    this.tSymbolsByFile.clear();
    // C
    this.cSymbols.clear();
    this.cSymbolsByFile.clear();
    // C++
    this.cppSymbols.clear();
    this.cppSymbolsByFile.clear();
    // Auxiliary
    this.structFields.clear();
    this.needsStructKeyword.clear();
    this.structState = createInitialStructState();
    this.enumBitWidth.clear();
  }
}

export default SymbolTable;
