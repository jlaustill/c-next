/**
 * C++ Namespace Detection Utilities
 *
 * Provides shared logic for detecting C++ namespaced types and converting
 * between underscore format (used in C headers) and :: format (used in C++).
 *
 * Issue #522: Consolidated from duplicate implementations in:
 * - CodeGenerator.ts (isCppScopeSymbol)
 * - generateStructHeader.ts (isCppNamespace, convertToCppNamespaceIfNeeded)
 */

import SymbolTable from "../symbol_resolution/SymbolTable";
import ESourceLanguage from "../types/ESourceLanguage";
import ESymbolKind from "../types/ESymbolKind";

/**
 * Static utility methods for C++ namespace operations
 */
class CppNamespaceUtils {
  /**
   * Check if a symbol name refers to a C++ scope-like symbol that requires :: syntax.
   * This includes C++ namespaces, classes, and enum classes (scoped enums).
   *
   * @param name - The symbol name to check (e.g., "SeaDash" or "Lib")
   * @param symbolTable - Optional symbol table for lookups
   * @returns true if the symbol is a C++ namespace, class, or enum
   */
  static isCppNamespace(
    name: string,
    symbolTable: SymbolTable | undefined,
  ): boolean {
    if (!symbolTable) {
      return false;
    }

    const symbols = symbolTable.getOverloads(name);
    for (const sym of symbols) {
      // Only consider C++ symbols
      if (sym.sourceLanguage !== ESourceLanguage.Cpp) {
        continue;
      }

      // C++ namespaces, classes, and enums (enum class) need :: syntax
      if (
        sym.kind === ESymbolKind.Namespace ||
        sym.kind === ESymbolKind.Class ||
        sym.kind === ESymbolKind.Enum
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a type name (potentially with underscores) is a C++ namespaced type.
   * This checks if the first part of an underscore-separated name is a C++ namespace.
   *
   * @param typeName - The type name to check (e.g., "SeaDash_Parse_ParseResult")
   * @param symbolTable - Optional symbol table for lookups
   * @returns true if this is a C++ namespaced type in underscore format
   */
  static isCppNamespaceType(
    typeName: string,
    symbolTable: SymbolTable | undefined,
  ): boolean {
    // Types already in :: format are clearly C++ namespaced
    if (typeName.includes("::")) {
      return true;
    }

    // Check underscore-separated names
    if (!typeName.includes("_")) {
      return false;
    }

    const parts = typeName.split("_");
    if (parts.length > 1) {
      return CppNamespaceUtils.isCppNamespace(parts[0], symbolTable);
    }

    return false;
  }

  /**
   * Convert underscore-separated type names to C++ namespace syntax
   * if the first part is a known C++ namespace.
   *
   * @param typeName - The type name to convert (e.g., "SeaDash_Parse_ParseResult")
   * @param symbolTable - Optional symbol table for lookups
   * @returns The converted type name (e.g., "SeaDash::Parse::ParseResult") or original if not C++ namespaced
   */
  static convertToCppNamespace(
    typeName: string,
    symbolTable: SymbolTable | undefined,
  ): string {
    // Already in :: format
    if (typeName.includes("::")) {
      return typeName;
    }

    // Only process types that contain underscores
    if (!typeName.includes("_")) {
      return typeName;
    }

    // Check if this looks like a qualified type
    const parts = typeName.split("_");
    if (
      parts.length > 1 &&
      CppNamespaceUtils.isCppNamespace(parts[0], symbolTable)
    ) {
      // It's a C++ namespaced type - convert _ to ::
      return parts.join("::");
    }

    return typeName;
  }
}

export default CppNamespaceUtils;
