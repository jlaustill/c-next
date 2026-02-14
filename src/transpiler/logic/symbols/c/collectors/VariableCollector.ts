/**
 * VariableCollector - Collects variable symbols from C parse trees.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type ICVariableSymbol from "../../../../types/symbols/c/ICVariableSymbol";
import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import DeclaratorUtils from "../utils/DeclaratorUtils";

class VariableCollector {
  /**
   * Collect a variable symbol from a declarator.
   *
   * @param name Variable name
   * @param baseType Variable type
   * @param declarator The declarator context (for array dimensions)
   * @param sourceFile Source file path
   * @param line Source line number
   * @param isExtern Whether the variable is extern
   */
  static collect(
    name: string,
    baseType: string,
    declarator: any,
    sourceFile: string,
    line: number,
    isExtern: boolean,
  ): ICVariableSymbol {
    // Extract array dimensions if present
    const arrayDimensions = declarator
      ? DeclaratorUtils.extractArrayDimensions(declarator)
      : [];

    return {
      kind: "variable",
      name,
      sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.C,
      isExported: !isExtern,
      type: baseType,
      isArray: arrayDimensions.length > 0,
      arrayDimensions: arrayDimensions.length > 0 ? arrayDimensions : undefined,
      isExtern,
    };
  }

  /**
   * Collect a variable from declaration specifiers (when identifier appears as typedefName).
   * This handles the C grammar ambiguity where variable names can be parsed as typedef names.
   *
   * @param name Variable name
   * @param baseType Variable type
   * @param sourceFile Source file path
   * @param line Source line number
   * @param isExtern Whether the variable is extern
   */
  static collectFromDeclSpecs(
    name: string,
    baseType: string,
    sourceFile: string,
    line: number,
    isExtern: boolean,
  ): ICVariableSymbol {
    return {
      kind: "variable",
      name,
      sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.C,
      isExported: !isExtern,
      type: baseType,
      isArray: false,
      isExtern,
    };
  }
}

export default VariableCollector;
