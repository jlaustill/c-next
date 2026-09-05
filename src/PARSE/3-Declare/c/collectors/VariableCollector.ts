/**
 * VariableCollector - Collects variable symbols from C parse trees.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type ICVariableSymbol from "../../../../transpiler/types/symbols/c/ICVariableSymbol";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import DeclaratorUtils from "../utils/DeclaratorUtils";
import type ISourceSpan from "../../../../transpiler/types/ISourceSpan";

class VariableCollector {
  /**
   * Collect a variable symbol from a declarator.
   *
   * @param name Variable name
   * @param baseType Variable type
   * @param declarator The declarator context (for array dimensions)
   * @param sourceFile Source file path
   * @param span Source span of the declaration
   * @param isExtern Whether the variable is extern
   */
  static collect(
    name: string,
    baseType: string,
    declarator: any,
    sourceFile: string,
    span: ISourceSpan,
    isExtern: boolean,
  ): ICVariableSymbol {
    // Extract array dimensions if present
    const arrayDimensions = declarator
      ? DeclaratorUtils.extractArrayDimensions(declarator)
      : [];

    // Issue #978: Detect pointer variables (e.g., `font_t *ptr`).
    // C grammar puts `*` in the declarator, not the type specifier.
    // Same pattern as FunctionCollector._resolveReturnType().
    const hasPointer =
      declarator?.pointer?.() !== null && declarator?.pointer?.() !== undefined;
    const resolvedType = hasPointer ? `${baseType}*` : baseType;

    return {
      kind: "variable",
      name,
      sourceFile,
      span,
      sourceLanguage: ESourceLanguage.C,
      visibility: "public",
      type: resolvedType,
      isArray: arrayDimensions.length > 0,
      arrayDimensions: arrayDimensions.length > 0 ? arrayDimensions : undefined,
      isExtern,
    };
  }

  /**
   * Collect a variable from declaration specifiers (when identifier appears as typedefName).
   * This handles the C grammar ambiguity where variable names can be parsed as typedef names.
   *
   * Note: No pointer detection here — this path handles declarations without an
   * initDeclaratorList. Pointer declarations (e.g., `font_t *ptr`) always produce
   * an initDeclaratorList (the `*` creates a declarator), so they go through collect().
   *
   * @param name Variable name
   * @param baseType Variable type
   * @param sourceFile Source file path
   * @param span Source span of the declaration
   * @param isExtern Whether the variable is extern
   */
  static collectFromDeclSpecs(
    name: string,
    baseType: string,
    sourceFile: string,
    span: ISourceSpan,
    isExtern: boolean,
  ): ICVariableSymbol {
    return {
      kind: "variable",
      name,
      sourceFile,
      span,
      sourceLanguage: ESourceLanguage.C,
      visibility: "public",
      type: baseType,
      isArray: false,
      isExtern,
    };
  }
}

export default VariableCollector;
