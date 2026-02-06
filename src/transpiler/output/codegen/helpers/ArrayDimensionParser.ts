/**
 * ArrayDimensionParser - Utility for parsing array dimension expressions
 *
 * Issue #644: Extracted from CodeGenerator to consolidate array dimension parsing.
 *
 * This helper consolidates 4 different patterns for array dimension parsing:
 * 1. _tryEvaluateConstant() - Full constant evaluation with const map
 * 2. _evaluateArrayDimensions() - Parse all dimensions, drop unresolved
 * 3. extractArrayDimensionsSimple() - Simple parseInt only
 * 4. _setParameters() inline - Use 0 for unresolved dimensions
 */

import LiteralUtils from "../../../../utils/LiteralUtils.js";
import * as Parser from "../../../logic/parser/grammar/CNextParser.js";

/**
 * Options for evaluating constant expressions.
 */
interface IConstantEvalOptions {
  /** Map of const variable names to their numeric values */
  constValues?: Map<string, number>;
  /** Map of type names to their bit widths (for sizeof) */
  typeWidths?: Record<string, number>;
  /** Function to check if a type name is a known struct */
  isKnownStruct?: (name: string) => boolean;
}

/**
 * Helper class for parsing array dimension expressions.
 *
 * Supports various expression forms:
 * - Integer literals (decimal, hex, binary)
 * - Const variable references
 * - sizeof(type) expressions
 * - Binary expressions with const values (CONST + CONST)
 */
class ArrayDimensionParser {
  /** Regex for identifier pattern */
  private static readonly IDENTIFIER_RE = /^[a-zA-Z_]\w*$/;
  /** Regex for const addition: CONST + CONST */
  private static readonly CONST_ADD_RE = /^([a-zA-Z_]\w*)\+([a-zA-Z_]\w*)$/;
  /** Regex for sizeof(type) */
  private static readonly SIZEOF_RE = /^sizeof\(([a-zA-Z_]\w*)\)$/;
  /** Regex for sizeof(type) * N */
  private static readonly SIZEOF_MUL_RE = /^sizeof\(([a-zA-Z_]\w*)\)\*(\d+)$/;
  /** Regex for sizeof(type) + N */
  private static readonly SIZEOF_ADD_RE = /^sizeof\(([a-zA-Z_]\w*)\)\+(\d+)$/;

  /**
   * Parse a single expression as a compile-time constant.
   *
   * This is the most complete evaluation, supporting:
   * - Integer literals (decimal, hex, binary)
   * - Const variable references
   * - sizeof(type) for primitive types
   * - sizeof(type) * N and sizeof(type) + N
   * - Binary expressions with const values (CONST + CONST)
   *
   * @param expr - The expression context to evaluate
   * @param options - Optional evaluation options
   * @returns The numeric value if constant, undefined if not evaluable
   */
  static parseSingleDimension(
    expr: Parser.ExpressionContext,
    options?: IConstantEvalOptions,
  ): number | undefined {
    const text = expr.getText().trim();

    // Try integer literal first (most common case)
    const literalValue = LiteralUtils.parseIntegerLiteral(text);
    if (literalValue !== undefined) {
      return literalValue;
    }

    // Try const identifier lookup
    const constResult = this._tryResolveConstIdentifier(text, options);
    if (constResult !== undefined) {
      return constResult;
    }

    // Try const binary expression (CONST + CONST)
    const binaryResult = this._tryEvaluateConstBinaryExpr(text, options);
    if (binaryResult !== undefined) {
      return binaryResult;
    }

    // Try sizeof expressions
    return this._tryEvaluateSizeofExpr(text, options);
  }

  /**
   * Try to resolve text as a const identifier.
   */
  private static _tryResolveConstIdentifier(
    text: string,
    options?: IConstantEvalOptions,
  ): number | undefined {
    const constValues = options?.constValues;
    if (!constValues || !this.IDENTIFIER_RE.test(text)) {
      return undefined;
    }
    return constValues.get(text);
  }

  /**
   * Try to evaluate text as a const binary expression (CONST + CONST).
   */
  private static _tryEvaluateConstBinaryExpr(
    text: string,
    options?: IConstantEvalOptions,
  ): number | undefined {
    const constValues = options?.constValues;
    if (!constValues) {
      return undefined;
    }

    const match = this.CONST_ADD_RE.exec(text);
    if (!match) {
      return undefined;
    }

    const left = constValues.get(match[1]);
    const right = constValues.get(match[2]);
    if (left !== undefined && right !== undefined) {
      return left + right;
    }
    return undefined;
  }

  /**
   * Try to evaluate text as a sizeof expression.
   * Handles: sizeof(type), sizeof(type) * N, sizeof(type) + N
   */
  private static _tryEvaluateSizeofExpr(
    text: string,
    options?: IConstantEvalOptions,
  ): number | undefined {
    const typeWidths = options?.typeWidths;
    if (!typeWidths) {
      return undefined;
    }

    // Try sizeof(type)
    const sizeofMatch = this.SIZEOF_RE.exec(text);
    if (sizeofMatch) {
      return this._evaluateSimpleSizeof(
        sizeofMatch[1],
        typeWidths,
        options?.isKnownStruct,
      );
    }

    // Try sizeof(type) * N
    const mulMatch = this.SIZEOF_MUL_RE.exec(text);
    if (mulMatch) {
      const bitWidth = typeWidths[mulMatch[1]];
      const multiplier = Number.parseInt(mulMatch[2], 10);
      if (bitWidth && !Number.isNaN(multiplier)) {
        return (bitWidth / 8) * multiplier;
      }
    }

    // Try sizeof(type) + N
    const addMatch = this.SIZEOF_ADD_RE.exec(text);
    if (addMatch) {
      const bitWidth = typeWidths[addMatch[1]];
      const addend = Number.parseInt(addMatch[2], 10);
      if (bitWidth && !Number.isNaN(addend)) {
        return bitWidth / 8 + addend;
      }
    }

    return undefined;
  }

  /**
   * Evaluate simple sizeof(type) expression.
   */
  private static _evaluateSimpleSizeof(
    typeName: string,
    typeWidths: Record<string, number>,
    isKnownStruct?: (name: string) => boolean,
  ): number | undefined {
    const bitWidth = typeWidths[typeName];
    if (bitWidth) {
      return bitWidth / 8; // Convert bits to bytes
    }
    // Check if it's a known struct - can't compute size at this point
    if (isKnownStruct?.(typeName)) {
      return undefined;
    }
    return undefined;
  }

  /**
   * Parse all array dimensions, dropping any that can't be resolved.
   *
   * Used for bitmap array registration and other contexts where
   * unresolved dimensions should be skipped.
   *
   * @param arrayDims - The array dimension contexts to parse
   * @param options - Optional evaluation options
   * @returns Array of resolved dimension values, or undefined if none resolved
   */
  static parseAllDimensions(
    arrayDims: Parser.ArrayDimensionContext[] | null,
    options?: IConstantEvalOptions,
  ): number[] | undefined {
    if (!arrayDims || arrayDims.length === 0) {
      return undefined;
    }

    const dimensions: number[] = [];
    for (const dim of arrayDims) {
      const sizeExpr = dim.expression();
      if (sizeExpr) {
        const size = ArrayDimensionParser.parseSingleDimension(
          sizeExpr,
          options,
        );
        if (size !== undefined && size > 0) {
          dimensions.push(size);
        }
      }
    }

    return dimensions.length > 0 ? dimensions : undefined;
  }

  /**
   * Process array dimensions with a custom handler for each dimension.
   * Shared iteration logic for parseSimpleDimensions and parseForParameters.
   *
   * @param arrayDims - The array dimension contexts to parse
   * @param onDimension - Handler called for each dimension (expr text or null for unsized)
   */
  private static _processDimensions(
    arrayDims: Parser.ArrayDimensionContext[] | null,
    onDimension: (exprText: string | null) => void,
  ): void {
    if (!arrayDims || arrayDims.length === 0) {
      return;
    }

    for (const dim of arrayDims) {
      const sizeExpr = dim.expression();
      onDimension(sizeExpr ? sizeExpr.getText() : null);
    }
  }

  /**
   * Parse array dimensions using simple parseInt only.
   *
   * Used for contexts where only literal integers are expected
   * (e.g., string array dimensions).
   *
   * @param arrayDims - The array dimension contexts to parse
   * @returns Array of resolved dimension values (may be empty)
   */
  static parseSimpleDimensions(
    arrayDims: Parser.ArrayDimensionContext[] | null,
  ): number[] {
    const dimensions: number[] = [];
    this._processDimensions(arrayDims, (exprText) => {
      if (exprText) {
        const size = Number.parseInt(exprText, 10);
        if (!Number.isNaN(size) && size > 0) {
          dimensions.push(size);
        }
      }
    });
    return dimensions;
  }

  /**
   * Parse array dimensions for parameters, using 0 for unresolved sizes.
   *
   * Parameters need to track dimension count even when size is unknown
   * (e.g., constant identifiers or unsized dimensions like arr[]).
   *
   * @param arrayDims - The array dimension contexts to parse
   * @returns Array of dimension values (0 for unresolved/unsized)
   */
  static parseForParameters(
    arrayDims: Parser.ArrayDimensionContext[] | null,
  ): number[] {
    const dimensions: number[] = [];
    this._processDimensions(arrayDims, (exprText) => {
      if (exprText) {
        const size = Number.parseInt(exprText, 10);
        dimensions.push(Number.isNaN(size) ? 0 : size);
      } else {
        // Unsized dimension (e.g., arr[]) - use 0 to indicate unknown size
        dimensions.push(0);
      }
    });
    return dimensions;
  }
}

export default ArrayDimensionParser;
