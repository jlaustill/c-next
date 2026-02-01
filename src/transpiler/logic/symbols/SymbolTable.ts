/**
 * Unified Symbol Table
 * Stores symbols from all source languages and detects conflicts
 */

import ISymbol from "../../../utils/types/ISymbol";
import ESourceLanguage from "../../../utils/types/ESourceLanguage";
import ESymbolKind from "../../../utils/types/ESymbolKind";
import IConflict from "./types/IConflict";
import IStructFieldInfo from "./types/IStructFieldInfo";

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

  /**
   * Clear all symbols
   */
  clear(): void {
    this.symbols.clear();
    this.byFile.clear();
    this.structFields.clear();
    this.needsStructKeyword.clear();
    this.enumBitWidth.clear();
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
      if (def.kind === ESymbolKind.Variable) {
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
}

export default SymbolTable;
