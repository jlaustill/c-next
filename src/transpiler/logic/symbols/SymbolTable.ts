/**
 * Unified Symbol Table
 * Stores symbols from all source languages and detects conflicts
 *
 * ADR-055 Phase 7: Fully typed symbol storage using discriminated unions.
 * - TSymbol: C-Next symbols (rich type system with TType)
 * - TCSymbol: C header symbols (string types)
 * - TCppSymbol: C++ header symbols (string types)
 */

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
   */
  private registerStructFields(struct: IStructSymbol): void {
    const mangledName = SymbolNameUtils.getMangledName(struct);

    for (const [fieldName, fieldInfo] of struct.fields) {
      // Convert TType to string for structFields map
      const typeString = TypeResolver.getTypeName(fieldInfo.type);

      // Filter to only numeric dimensions (structFields doesn't support string dims)
      const numericDims = fieldInfo.dimensions?.filter(
        (d): d is number => typeof d === "number",
      );

      this.addStructField(
        mangledName,
        fieldName,
        typeString,
        numericDims && numericDims.length > 0 ? numericDims : undefined,
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
        const variable = def as IVariableSymbol;
        // Global scope means no conflict filtering needed
        if (variable.scope.name === "") return true;
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

    if (cnextDefs.length > 0 && (cDefs.length > 0 || cppDefs.length > 0)) {
      const locations = globalDefinitions.map(
        (s) =>
          `${s.sourceLanguage.toUpperCase()} (${s.sourceFile}:${s.sourceLine})`,
      );

      return {
        symbolName: globalDefinitions[0].name,
        definitions: globalDefinitions,
        severity: "error",
        message: `Symbol conflict: '${globalDefinitions[0].name}' is defined in multiple languages:\n  ${locations.join("\n  ")}\nRename the C-Next symbol to resolve.`,
      };
    }

    // Multiple definitions in same language (excluding overloads) = ERROR
    if (cnextDefs.length > 1) {
      const locations = cnextDefs.map((s) => `${s.sourceFile}:${s.sourceLine}`);
      return {
        symbolName: cnextDefs[0].name,
        definitions: cnextDefs,
        severity: "error",
        message: `Symbol conflict: '${cnextDefs[0].name}' is defined multiple times in C-Next:\n  ${locations.join("\n  ")}`,
      };
    }

    // Same symbol in C and C++ - typically OK (same symbol)
    if (cDefs.length > 0 && cppDefs.length > 0) {
      return null;
    }

    return null;
  }

  // ========================================================================
  // Struct Field Information
  // ========================================================================

  /**
   * Add struct field information
   * @param structName Name of the struct
   * @param fieldName Name of the field
   * @param fieldType Type of the field (e.g., "uint32_t")
   * @param arrayDimensions Optional array dimensions if field is an array
   */
  addStructField(
    structName: string,
    fieldName: string,
    fieldType: string,
    arrayDimensions?: number[],
  ): void {
    let fields = this.structFields.get(structName);
    if (!fields) {
      fields = new Map();
      this.structFields.set(structName, fields);
    }

    fields.set(fieldName, {
      type: fieldType,
      arrayDimensions,
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
    // Build a map of all const values from C-Next symbols
    const constValues = new Map<string, number>();
    for (const symbol of this.getAllTSymbols()) {
      if (symbol.kind === "variable" && symbol.isConst) {
        const variable = symbol as IVariableSymbol;
        if (variable.initialValue !== undefined) {
          const value = LiteralUtils.parseIntegerLiteral(variable.initialValue);
          if (value !== undefined) {
            constValues.set(symbol.name, value);
          }
        }
      }
    }

    // If no const values found, nothing to resolve
    if (constValues.size === 0) {
      return;
    }

    // Scan all C-Next variable symbols for unresolved array dimensions
    for (const symbol of this.getAllTSymbols()) {
      if (symbol.kind === "variable") {
        const variable = symbol as IVariableSymbol;
        if (variable.isArray && variable.arrayDimensions) {
          let modified = false;
          const resolvedDimensions = variable.arrayDimensions.map((dim) => {
            // If dimension is numeric, keep it
            if (typeof dim === "number") {
              return dim;
            }

            // Try to resolve from const values
            const constValue = constValues.get(dim);
            if (constValue !== undefined) {
              modified = true;
              return constValue;
            }

            // Keep original (unresolved macro reference)
            return dim;
          });

          if (modified) {
            // Update the symbol's array dimensions (cast to mutable via unknown)
            (
              variable as unknown as { arrayDimensions: (number | string)[] }
            ).arrayDimensions = resolvedDimensions;
          }
        }
      }
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
    this.enumBitWidth.clear();
  }
}

export default SymbolTable;
