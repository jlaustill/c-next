/**
 * VariableCollector - Extracts variable declarations from C++ parse trees.
 *
 * Produces ICppVariableSymbol instances.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import ICppVariableSymbol from "../../../../types/symbols/cpp/ICppVariableSymbol";
import DeclaratorUtils from "../utils/DeclaratorUtils";

class VariableCollector {
  /**
   * Collect a variable declaration and return an ICppVariableSymbol.
   *
   * @param declarator The declarator context
   * @param baseType The variable type string
   * @param sourceFile Source file path
   * @param line Line number
   * @param currentNamespace Optional current namespace
   * @returns The variable symbol or null if no name
   */
  static collect(
    declarator: any,
    baseType: string,
    sourceFile: string,
    line: number,
    currentNamespace?: string,
  ): ICppVariableSymbol | null {
    const name = DeclaratorUtils.extractDeclaratorName(declarator);
    if (!name) return null;

    const fullName = currentNamespace ? `${currentNamespace}::${name}` : name;

    // Extract array dimensions
    const arrayDimensions = DeclaratorUtils.extractArrayDimensions(declarator);

    return {
      kind: "variable",
      name: fullName,
      type: baseType,
      sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.Cpp,
      isExported: true,
      parent: currentNamespace,
      isArray: arrayDimensions.length > 0 ? true : undefined,
      arrayDimensions: arrayDimensions.length > 0 ? arrayDimensions : undefined,
    };
  }
}

export default VariableCollector;
