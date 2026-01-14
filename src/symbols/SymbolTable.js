"use strict";
/**
 * Unified Symbol Table
 * Stores symbols from all source languages and detects conflicts
 */
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
const ESourceLanguage_1 = __importDefault(require("../types/ESourceLanguage"));
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
  symbols = new Map();
  /** Symbols indexed by source file */
  byFile = new Map();
  /** Struct field information: struct name -> (field name -> field info) */
  structFields = new Map();
  /**
   * Add a symbol to the table
   */
  addSymbol(symbol) {
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
  addSymbols(symbols) {
    for (const symbol of symbols) {
      this.addSymbol(symbol);
    }
  }
  /**
   * Get a symbol by name (returns first match, or undefined)
   */
  getSymbol(name) {
    const symbols = this.symbols.get(name);
    return symbols?.[0];
  }
  /**
   * Get all symbols with a given name (for overload detection)
   */
  getOverloads(name) {
    return this.symbols.get(name) ?? [];
  }
  /**
   * Check if a symbol exists
   */
  hasSymbol(name) {
    return this.symbols.has(name);
  }
  /**
   * Check if a symbol has conflicts
   */
  hasConflict(name) {
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
  getConflicts() {
    const conflicts = [];
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
  getSymbolsByFile(file) {
    return this.byFile.get(file) ?? [];
  }
  /**
   * Get symbols by source language
   */
  getSymbolsByLanguage(lang) {
    const result = [];
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
  getAllSymbols() {
    const result = [];
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
  addStructField(structName, fieldName, fieldType, arrayDimensions) {
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
  getStructFieldType(structName, fieldName) {
    const fields = this.structFields.get(structName);
    return fields?.get(fieldName)?.type;
  }
  /**
   * Get struct field info (type and array dimensions)
   * @param structName Name of the struct
   * @param fieldName Name of the field
   * @returns Field info or undefined if not found
   */
  getStructFieldInfo(structName, fieldName) {
    const fields = this.structFields.get(structName);
    return fields?.get(fieldName);
  }
  /**
   * Get all fields for a struct
   * @param structName Name of the struct
   * @returns Map of field names to field info, or undefined if struct not found
   */
  getStructFields(structName) {
    return this.structFields.get(structName);
  }
  /**
   * Clear all symbols
   */
  clear() {
    this.symbols.clear();
    this.byFile.clear();
    this.structFields.clear();
  }
  /**
   * Get symbol count
   */
  get size() {
    let count = 0;
    for (const symbols of this.symbols.values()) {
      count += symbols.length;
    }
    return count;
  }
  /**
   * Detect if a set of symbols with the same name represents a conflict
   */
  detectConflict(symbols) {
    // Filter out pure declarations (extern in C) - they don't count as definitions
    const definitions = symbols.filter((s) => !s.isDeclaration);
    if (definitions.length <= 1) {
      // 0 or 1 definitions = no conflict
      return null;
    }
    // Check for C++ function overloads (different signatures are OK)
    const cppFunctions = definitions.filter(
      (s) => s.sourceLanguage === ESourceLanguage_1.default.Cpp && s.signature,
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
    const cnextDefs = definitions.filter(
      (s) => s.sourceLanguage === ESourceLanguage_1.default.CNext,
    );
    const cDefs = definitions.filter(
      (s) => s.sourceLanguage === ESourceLanguage_1.default.C,
    );
    const cppDefs = definitions.filter(
      (s) => s.sourceLanguage === ESourceLanguage_1.default.Cpp,
    );
    if (cnextDefs.length > 0 && (cDefs.length > 0 || cppDefs.length > 0)) {
      // C-Next + C/C++ conflict = ERROR
      const locations = definitions.map(
        (s) =>
          `${s.sourceLanguage.toUpperCase()} (${s.sourceFile}:${s.sourceLine})`,
      );
      return {
        symbolName: definitions[0].name,
        definitions,
        severity: "error",
        message: `Symbol conflict: '${definitions[0].name}' is defined in multiple languages:\n  ${locations.join("\n  ")}\nRename the C-Next symbol to resolve.`,
      };
    }
    // Multiple definitions in same language (excluding overloads) = ERROR
    if (cnextDefs.length > 1) {
      const locations = cnextDefs.map((s) => `${s.sourceFile}:${s.sourceLine}`);
      return {
        symbolName: definitions[0].name,
        definitions: cnextDefs,
        severity: "error",
        message: `Symbol conflict: '${definitions[0].name}' is defined multiple times in C-Next:\n  ${locations.join("\n  ")}`,
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
exports.default = SymbolTable;
