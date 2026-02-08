/**
 * SymbolLookupHelper
 *
 * Helper class for symbol table lookup operations.
 * Extracts common lookup patterns for improved testability.
 */

import ESymbolKind from "../../../../utils/types/ESymbolKind.js";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage.js";

/**
 * Symbol interface for lookups
 */
interface ISymbol {
  kind: ESymbolKind;
  sourceLanguage: ESourceLanguage;
}

/**
 * Symbol table interface
 */
interface ISymbolTable {
  getOverloads(name: string): ISymbol[];
  getStructFields?(name: string): unknown;
}

class SymbolLookupHelper {
  /**
   * Check if a symbol exists with the given kind and language.
   */
  static hasSymbolWithKindAndLanguage(
    symbolTable: ISymbolTable | null | undefined,
    name: string,
    kind: ESymbolKind,
    languages: ESourceLanguage[],
  ): boolean {
    if (!symbolTable) return false;

    const symbols = symbolTable.getOverloads(name);
    return symbols.some(
      (sym) => sym.kind === kind && languages.includes(sym.sourceLanguage),
    );
  }

  /**
   * Check if a type is a C++ enum class (scoped enum).
   * Issue #304: These require explicit casts to integer types in C++.
   */
  static isCppEnumClass(
    symbolTable: ISymbolTable | null | undefined,
    typeName: string,
  ): boolean {
    return SymbolLookupHelper.hasSymbolWithKindAndLanguage(
      symbolTable,
      typeName,
      ESymbolKind.Enum,
      [ESourceLanguage.Cpp],
    );
  }

  /**
   * Check if a function is an external C or C++ function.
   * External functions use pass-by-value semantics.
   */
  static isExternalCFunction(
    symbolTable: ISymbolTable | null | undefined,
    name: string,
  ): boolean {
    return SymbolLookupHelper.hasSymbolWithKindAndLanguage(
      symbolTable,
      name,
      ESymbolKind.Function,
      [ESourceLanguage.C, ESourceLanguage.Cpp],
    );
  }

  /**
   * Check if a name refers to a namespace/scope.
   */
  static isNamespace(
    symbolTable: ISymbolTable | null | undefined,
    name: string,
  ): boolean {
    if (!symbolTable) return false;

    const symbols = symbolTable.getOverloads(name);
    return symbols.some((sym) => sym.kind === ESymbolKind.Namespace);
  }

  /**
   * Check if a type name is from a C++ header.
   * Issue #304: Used to determine whether to use {} or {0} for initialization.
   * C++ types with constructors may fail with {0} but work with {}.
   */
  static isCppType(
    symbolTable: ISymbolTable | null | undefined,
    typeName: string,
  ): boolean {
    if (!symbolTable) return false;

    const symbols = symbolTable.getOverloads(typeName);
    const cppTypeKinds = new Set([
      ESymbolKind.Struct,
      ESymbolKind.Class,
      ESymbolKind.Type,
    ]);

    return symbols.some(
      (sym) =>
        sym.sourceLanguage === ESourceLanguage.Cpp &&
        cppTypeKinds.has(sym.kind),
    );
  }

  /**
   * Check if a function is a C-Next function (uses pass-by-reference semantics).
   * Returns true if the function is found in symbol table as C-Next.
   */
  static isCNextFunction(
    symbolTable: ISymbolTable | null | undefined,
    name: string,
  ): boolean {
    return SymbolLookupHelper.hasSymbolWithKindAndLanguage(
      symbolTable,
      name,
      ESymbolKind.Function,
      [ESourceLanguage.CNext],
    );
  }

  /**
   * Check if a function is a C-Next function (combined local + symbol table lookup).
   * Checks local knownFunctions set first, then falls back to symbol table.
   */
  static isCNextFunctionCombined(
    knownFunctions: ReadonlySet<string> | undefined,
    symbolTable: ISymbolTable | null | undefined,
    name: string,
  ): boolean {
    if (knownFunctions?.has(name)) return true;
    return SymbolLookupHelper.isCNextFunction(symbolTable, name);
  }

  /**
   * Check if a name is a known scope (combined local + symbol table lookup).
   * Checks local knownScopes set first, then falls back to symbol table.
   */
  static isKnownScope(
    knownScopes: ReadonlySet<string> | undefined,
    symbolTable: ISymbolTable | null | undefined,
    name: string,
  ): boolean {
    if (knownScopes?.has(name)) return true;
    return SymbolLookupHelper.isNamespace(symbolTable, name);
  }

  /**
   * Check if a type is a known struct (combined local + symbol table lookup).
   * Checks local knownStructs and knownBitmaps, then falls back to symbol table.
   * Issue #551: Bitmaps are struct-like (use pass-by-reference with -> access).
   */
  static isKnownStruct(
    knownStructs: ReadonlySet<string> | undefined,
    knownBitmaps: ReadonlySet<string> | undefined,
    symbolTable: ISymbolTable | null | undefined,
    typeName: string,
  ): boolean {
    if (knownStructs?.has(typeName)) return true;
    if (knownBitmaps?.has(typeName)) return true;
    if (symbolTable?.getStructFields?.(typeName)) return true;
    return false;
  }
}

export default SymbolLookupHelper;
