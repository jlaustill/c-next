/**
 * CppConstructorHelper
 *
 * Helper class for C++ constructor detection logic.
 * Issue #517: C++ classes with user-defined constructors are NOT aggregate types,
 * so designated initializers { .field = value } don't work with them.
 */

import ESymbolKind from "../../../../utils/types/ESymbolKind.js";

/**
 * Symbol lookup interface for constructor detection
 */
interface ISymbolLookup {
  getSymbol(name: string): { kind: ESymbolKind } | undefined;
}

class CppConstructorHelper {
  /**
   * Convert underscore format to :: for namespaced types.
   * e.g., TestNS_MyClass -> TestNS::MyClass
   */
  static toQualifiedName(typeName: string): string {
    if (typeName.includes("_") && !typeName.includes("::")) {
      return typeName.replaceAll("_", "::");
    }
    return typeName;
  }

  /**
   * Extract just the class name (part after last ::).
   * e.g., TestNS::MyClass -> MyClass, CppTestClass -> CppTestClass
   */
  static extractClassName(qualifiedName: string): string {
    const parts = qualifiedName.split("::");
    return parts.at(-1)!;
  }

  /**
   * Build the constructor name pattern.
   * e.g., TestNS::MyClass -> TestNS::MyClass::MyClass
   */
  static buildConstructorName(
    qualifiedName: string,
    className: string,
  ): string {
    return `${qualifiedName}::${className}`;
  }

  /**
   * Check if a type has a C++ constructor in the symbol table.
   *
   * @param typeName - The type name (may use underscore or :: notation)
   * @param symbolTable - Symbol table for lookup (may be null)
   * @returns true if a constructor function symbol exists
   */
  static hasConstructor(
    typeName: string,
    symbolTable: ISymbolLookup | null | undefined,
  ): boolean {
    if (!symbolTable) return false;

    const qualifiedName = CppConstructorHelper.toQualifiedName(typeName);
    const className = CppConstructorHelper.extractClassName(qualifiedName);
    const constructorName = CppConstructorHelper.buildConstructorName(
      qualifiedName,
      className,
    );

    const constructorSymbol = symbolTable.getSymbol(constructorName);
    return constructorSymbol?.kind === ESymbolKind.Function;
  }
}

export default CppConstructorHelper;
