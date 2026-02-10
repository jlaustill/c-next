/**
 * VariableCollector - Extracts variable declarations from parse trees.
 * Handles types, const modifier, arrays, and initial values.
 */

import * as Parser from "../../../parser/grammar/CNextParser";
import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import ESymbolKind from "../../../../../utils/types/ESymbolKind";
import IVariableSymbol from "../../types/IVariableSymbol";
import ArrayInitializerUtils from "../utils/ArrayInitializerUtils";
import TypeUtils from "../utils/TypeUtils";
import LiteralUtils from "../../../../../utils/LiteralUtils";

class VariableCollector {
  /**
   * Resolve a single array dimension to a number or string.
   * Returns undefined if the dimension cannot be resolved.
   */
  private static resolveDimension(
    dim: Parser.ArrayDimensionContext,
    constValues: Map<string, number> | undefined,
    initExpr: Parser.ExpressionContext | null,
  ): number | string | undefined {
    const sizeExpr = dim.expression();

    if (sizeExpr) {
      const dimText = sizeExpr.getText();
      // Try parsing as literal number first
      const literalSize = Number.parseInt(dimText, 10);
      if (!Number.isNaN(literalSize)) {
        return literalSize;
      }
      // Issue #455: Resolve constant reference to its value
      if (constValues?.has(dimText)) {
        return constValues.get(dimText)!;
      }
      // Issue #455: Store original text for unresolved dimensions
      // This handles C macros from included headers (e.g., DEVICE_COUNT)
      return dimText;
    }

    // Issue #636: Empty dimension [] - infer size from array initializer
    if (initExpr) {
      return ArrayInitializerUtils.getInferredSize(initExpr);
    }

    return undefined;
  }

  /**
   * Collect array dimensions from a variable declaration.
   */
  private static collectArrayDimensions(
    arrayDims: Parser.ArrayDimensionContext[],
    constValues: Map<string, number> | undefined,
    initExpr: Parser.ExpressionContext | null,
  ): (number | string)[] {
    const dimensions: (number | string)[] = [];

    for (const dim of arrayDims) {
      const resolved = VariableCollector.resolveDimension(
        dim,
        constValues,
        initExpr,
      );
      if (resolved !== undefined) {
        dimensions.push(resolved);
      }
    }

    return dimensions;
  }

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

    // Issue #468: Check for atomic modifier
    const isAtomic = ctx.atomicModifier() !== null;

    // Check for array dimensions - both C-style (arrayDimension) and C-Next style (arrayType)
    const arrayDims = ctx.arrayDimension();
    const arrayTypeCtx = typeCtx.arrayType();
    const hasArrayTypeSyntax = arrayTypeCtx !== null;
    const isArray = arrayDims.length > 0 || hasArrayTypeSyntax;
    const initExpr = ctx.expression();
    const arrayDimensions: (number | string)[] = [];

    // Collect dimensions from arrayType syntax (u16[8] arr, u16[4][4] arr, u16[] arr)
    if (hasArrayTypeSyntax) {
      for (const dim of arrayTypeCtx.arrayTypeDimension()) {
        const sizeExpr = dim.expression();
        if (sizeExpr) {
          const dimText = sizeExpr.getText();
          const literalSize = LiteralUtils.parseIntegerLiteral(dimText);
          if (literalSize !== undefined) {
            arrayDimensions.push(literalSize);
          } else if (constValues?.has(dimText)) {
            arrayDimensions.push(constValues.get(dimText)!);
          } else {
            // Keep as string for macro/enum references
            arrayDimensions.push(dimText);
          }
        }
      }
    }

    // Collect additional dimensions from arrayDimension syntax
    if (arrayDims.length > 0) {
      arrayDimensions.push(
        ...VariableCollector.collectArrayDimensions(
          arrayDims,
          constValues,
          initExpr,
        ),
      );
    }

    // Issue #282: Capture initial value for const inlining
    const initialValue = initExpr?.getText();

    const symbol: IVariableSymbol = {
      name: fullName,
      parent: scopeName,
      sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.CNext,
      isExported: isPublic,
      kind: ESymbolKind.Variable,
      type,
      isConst,
      isAtomic,
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
