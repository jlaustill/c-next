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
    const cppTypeKinds = [
      ESymbolKind.Struct,
      ESymbolKind.Class,
      ESymbolKind.Type,
    ];

    return symbols.some(
      (sym) =>
        sym.sourceLanguage === ESourceLanguage.Cpp &&
        cppTypeKinds.includes(sym.kind),
    );
  }
}

export default SymbolLookupHelper;
