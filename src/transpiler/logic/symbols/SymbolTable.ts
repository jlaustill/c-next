/**
 * Unified Symbol Table
 * Stores symbols from all source languages and detects conflicts
 *
 * ADR-055 Phase 5: Supports both legacy ISymbol and new TSymbol storage.
 * - TSymbol: Discriminated union for C-Next symbols (type-safe)
 * - ISymbol: Flat interface for C/C++ backwards compatibility
 */

import ISymbol from "../../../utils/types/ISymbol";
import ESourceLanguage from "../../../utils/types/ESourceLanguage";
import LiteralUtils from "../../../utils/LiteralUtils";
import IConflict from "../../types/IConflict";
import IStructFieldInfo from "../../types/symbols/IStructFieldInfo";
import TSymbol from "../../types/symbols/TSymbol";
import IStructSymbol from "../../types/symbols/IStructSymbol";
import IEnumSymbol from "../../types/symbols/IEnumSymbol";
import IFunctionSymbol from "../../types/symbols/IFunctionSymbol";
import IVariableSymbol from "../../types/symbols/IVariableSymbol";
import TypeResolver from "../../../utils/TypeResolver";

/**
 * Central symbol table for cross-language interoperability
 *
 * Per user requirement: Symbol conflicts between C-Next and C/C++ are ERRORS.
 * - ERROR: Same symbol defined in C-Next and C/C++
 * - OK: Multiple `extern` declarations in C (declaration, not definition)
 * - OK: Function overloads in C++ (different signatures)
 */
class SymbolTable {
  /** All symbols indexed by name */
  private readonly symbols: Map<string, ISymbol[]> = new Map();

  /** Symbols indexed by source file */
  private readonly byFile: Map<string, ISymbol[]> = new Map();

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
  // ADR-055 Phase 5: TSymbol storage (parallel to ISymbol for migration)
  // ========================================================================

  /** All TSymbols indexed by name */
  private readonly tSymbols: Map<string, TSymbol[]> = new Map();

  /** TSymbols indexed by source file */
  private readonly tSymbolsByFile: Map<string, TSymbol[]> = new Map();

  /**
   * Add a symbol to the table
   */
  addSymbol(symbol: ISymbol): void {
    // Add to name index
    const existing = this.symbols.get(symbol.name);
    if (existing) {
      existing.push(symbol);
    } else {
      this.symbols.set(symbol.name, [symbol]);
    }

    // Add to file index
    const fileSymbols = this.byFile.get(symbol.sourceFile);
    if (fileSymbols) {
      fileSymbols.push(symbol);
    } else {
      this.byFile.set(symbol.sourceFile, [symbol]);
    }
  }

  /**
   * Add multiple symbols at once
   */
  addSymbols(symbols: ISymbol[]): void {
    for (const symbol of symbols) {
      this.addSymbol(symbol);
    }
  }

  /**
   * Get a symbol by name (returns first match, or undefined)
   */
  getSymbol(name: string): ISymbol | undefined {
    const symbols = this.symbols.get(name);
    return symbols?.[0];
  }

  /**
   * Get all symbols with a given name (for overload detection)
   */
  getOverloads(name: string): ISymbol[] {
    return this.symbols.get(name) ?? [];
  }

  /**
   * Check if a symbol exists
   */
  hasSymbol(name: string): boolean {
    return this.symbols.has(name);
  }

  /**
   * Check if a symbol has conflicts
   */
  hasConflict(name: string): boolean {
    const symbols = this.symbols.get(name);
    if (!symbols || symbols.length <= 1) {
      return false;
    }

    return this.detectConflict(symbols) !== null;
  }

  /**
   * Get all conflicts in the symbol table
   * Per user requirement: Strict errors for cross-language conflicts
   */
  getConflicts(): IConflict[] {
    const conflicts: IConflict[] = [];

    for (const [, symbols] of this.symbols) {
      if (symbols.length <= 1) continue;

      const conflict = this.detectConflict(symbols);
      if (conflict) {
        conflicts.push(conflict);
      }
    }

    return conflicts;
  }

  /**
   * Get symbols by source file
   */
  getSymbolsByFile(file: string): ISymbol[] {
    return this.byFile.get(file) ?? [];
  }

  /**
   * Get symbols by source language
   */
  getSymbolsByLanguage(lang: ESourceLanguage): ISymbol[] {
    const result: ISymbol[] = [];
    for (const symbols of this.symbols.values()) {
      for (const symbol of symbols) {
        if (symbol.sourceLanguage === lang) {
          result.push(symbol);
        }
      }
    }
    return result;
  }

  /**
   * Get all symbols
   */
  getAllSymbols(): ISymbol[] {
    const result: ISymbol[] = [];
    for (const symbols of this.symbols.values()) {
      result.push(...symbols);
    }
    return result;
  }

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
      // Get or create the struct's field map
      let existingFields = this.structFields.get(structName);
      if (!existingFields) {
        existingFields = new Map();
        this.structFields.set(structName, existingFields);
      }

      // Merge fields
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
    const fileSymbols = this.byFile.get(file) ?? [];
    // Issue #196: Include any symbol that has struct fields registered
    // The dual-parse strategy may register typedef'd anonymous structs as variables
    // (e.g., "typedef struct { ... } Rectangle;" -> Rectangle has kind=variable)
    // But the C parser still adds struct fields for it
    const symbolNames = fileSymbols.map((s) => s.name);
    return symbolNames.filter((name) => this.structFields.has(name));
  }

  // ========================================================================
  // ADR-055 Phase 5: TSymbol Methods
  // ========================================================================

  /**
   * Add a TSymbol to the table
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
  }

  /**
   * Add multiple TSymbols at once
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
   * ADR-055 Phase 5: Get struct field type directly from TSymbol storage.
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
  get tSize(): number {
    let count = 0;
    for (const symbols of this.tSymbols.values()) {
      count += symbols.length;
    }
    return count;
  }

  /**
   * Clear all symbols
   */
  clear(): void {
    this.symbols.clear();
    this.byFile.clear();
    this.structFields.clear();
    this.needsStructKeyword.clear();
    this.enumBitWidth.clear();
    // ADR-055 Phase 5: Clear TSymbol storage
    this.tSymbols.clear();
    this.tSymbolsByFile.clear();
  }

  /**
   * Get symbol count
   */
  get size(): number {
    let count = 0;
    for (const symbols of this.symbols.values()) {
      count += symbols.length;
    }
    return count;
  }

  /**
   * Detect if a set of symbols with the same name represents a conflict
   */
  private detectConflict(symbols: ISymbol[]): IConflict | null {
    // Filter out pure declarations (extern in C) - they don't count as definitions
    const definitions = symbols.filter((s) => !s.isDeclaration);

    if (definitions.length <= 1) {
      // 0 or 1 definitions = no conflict
      return null;
    }

    // Issue #221: Filter out function parameters from conflict detection
    // Function parameters have a parent (their containing function) but their name
    // is NOT qualified with the parent prefix (unlike scope-level variables like Math_counter).
    // Parameters with the same name in different functions are not conflicts.
    const globalDefinitions = definitions.filter((def) => {
      // If no parent, it's a global symbol - keep it
      if (!def.parent) return true;

      // Variables with a parent need special handling
      if (def.kind === "variable") {
        // Scope-level variables have qualified names (e.g., "Math_counter" with parent "Math")
        // Function parameters have unqualified names (e.g., "x" with parent "Math_add")
        // If the name starts with parent_, it's a scope-level variable - keep it
        // If not, it's a function parameter - filter it out
        const isQualifiedName = def.name.startsWith(def.parent + "_");
        return isQualifiedName;
      }

      // Non-variable symbols with parents (functions, enums, etc.) are kept
      return true;
    });

    if (globalDefinitions.length <= 1) {
      // After filtering parameters, 0 or 1 definitions = no conflict
      return null;
    }

    // Check for C++ function overloads (different signatures are OK)
    const cppFunctions = definitions.filter(
      (s) => s.sourceLanguage === ESourceLanguage.Cpp && s.signature,
    );
    if (cppFunctions.length === definitions.length) {
      // All are C++ functions with signatures
      const uniqueSignatures = new Set(cppFunctions.map((s) => s.signature));
      if (uniqueSignatures.size === cppFunctions.length) {
        // All signatures are unique = valid overload, no conflict
        return null;
      }
    }

    // Check for cross-language conflict (C-Next vs C or C++)
    // Issue #221: Use globalDefinitions for C-Next to exclude function parameters
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
      // C-Next + C/C++ conflict = ERROR
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
    // But if they have different types, might be a warning
    if (cDefs.length > 0 && cppDefs.length > 0) {
      // For now, allow C/C++ to share symbols (common pattern)
      return null;
    }

    return null;
  }

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
    // Build a map of all const values from the symbol table
    const constValues = new Map<string, number>();
    for (const symbol of this.getAllSymbols()) {
      if (
        symbol.kind === "variable" &&
        symbol.isConst &&
        symbol.initialValue !== undefined
      ) {
        const value = LiteralUtils.parseIntegerLiteral(symbol.initialValue);
        if (value !== undefined) {
          constValues.set(symbol.name, value);
        }
      }
    }

    // If no const values found, nothing to resolve
    if (constValues.size === 0) {
      return;
    }

    // Scan all variable symbols for unresolved array dimensions
    for (const symbol of this.getAllSymbols()) {
      if (
        symbol.kind === "variable" &&
        symbol.isArray &&
        symbol.arrayDimensions
      ) {
        let modified = false;
        const resolvedDimensions = symbol.arrayDimensions.map((dim) => {
          // If dimension is numeric, keep it
          const numericValue = Number.parseInt(dim, 10);
          if (!Number.isNaN(numericValue)) {
            return dim;
          }

          // Try to resolve from const values
          const constValue = constValues.get(dim);
          if (constValue !== undefined) {
            modified = true;
            return String(constValue);
          }

          // Keep original (unresolved macro reference)
          return dim;
        });

        if (modified) {
          // Update the symbol's array dimensions
          symbol.arrayDimensions = resolvedDimensions;
        }
      }
    }
  }
}

export default SymbolTable;
