/**
 * VariableCollector - Extracts variable declarations from parse trees.
 * Handles types, const modifier, arrays, and initial values.
 */

import * as Parser from "../../../antlr_parser/grammar/CNextParser";
import ESourceLanguage from "../../../types/ESourceLanguage";
import ESymbolKind from "../../../types/ESymbolKind";
import IVariableSymbol from "../../types/IVariableSymbol";
import TypeUtils from "../utils/TypeUtils";

class VariableCollector {
  /**
   * Collect a variable declaration and return an IVariableSymbol.
   *
   * @param ctx The variable declaration context
   * @param sourceFile Source file path
   * @param scopeName Optional scope name for scoped variables
   * @param isPublic Whether this variable is public (default true for top-level)
   * @param constValues Map of constant names to their numeric values (for resolving array dimensions)
   * @returns The variable symbol
   */
  static collect(
    ctx: Parser.VariableDeclarationContext,
    sourceFile: string,
    scopeName?: string,
    isPublic: boolean = true,
    constValues?: Map<string, number>,
  ): IVariableSymbol {
    const name = ctx.IDENTIFIER().getText();
    const fullName = scopeName ? `${scopeName}_${name}` : name;
    const line = ctx.start?.line ?? 0;

    // Get type
    const typeCtx = ctx.type();
    const type = TypeUtils.getTypeName(typeCtx, scopeName);

    // Check for const modifier
    const isConst = ctx.constModifier() !== null;

    // Check for array dimensions
    const arrayDims = ctx.arrayDimension();
    const isArray = arrayDims.length > 0;
    const arrayDimensions: (number | string)[] = [];

    if (isArray) {
      for (const dim of arrayDims) {
        const sizeExpr = dim.expression();
        if (sizeExpr) {
          const dimText = sizeExpr.getText();
          // Try parsing as literal number first
          const literalSize = Number.parseInt(dimText, 10);
          if (!Number.isNaN(literalSize)) {
            arrayDimensions.push(literalSize);
          } else if (constValues?.has(dimText)) {
            // Issue #455: Resolve constant reference to its value
            arrayDimensions.push(constValues.get(dimText)!);
          } else {
            // Issue #455: Store original text for unresolved dimensions
            // This handles C macros from included headers (e.g., DEVICE_COUNT)
            // which should pass through to the generated header unchanged
            arrayDimensions.push(dimText);
          }
        }
      }
    }

    // Issue #282: Capture initial value for const inlining
    let initialValue: string | undefined;
    const exprCtx = ctx.expression();
    if (exprCtx) {
      initialValue = exprCtx.getText();
    }

    const symbol: IVariableSymbol = {
      name: fullName,
      sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.CNext,
      isExported: isPublic,
      kind: ESymbolKind.Variable,
      type,
      isConst,
      isArray,
    };

    if (arrayDimensions.length > 0) {
      symbol.arrayDimensions = arrayDimensions;
    }

    if (initialValue !== undefined) {
      symbol.initialValue = initialValue;
    }

    return symbol;
  }
}

export default VariableCollector;
