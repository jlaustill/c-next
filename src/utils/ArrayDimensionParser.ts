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

import LiteralUtils from "./LiteralUtils.js";
import * as Parser from "../transpiler/logic/parser/grammar/CNextParser.js";
import UNRESOLVED_DIMENSION from "../transpiler/constants/UNRESOLVED_DIMENSION.js";

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
  /**
   * Regex for addition of two operands, each an integer literal or a const
   * identifier: `8+1`, `SIZE+1`, `1+SIZE`, `SIZE+OFFSET`.
   *
   * Issue #1157: this required an identifier on both sides, so `u8[8+1]` did
   * not fold. A dimension that does not fold is dropped by the collectors, which left
   * the field marked as an array with no dimensions -- the header emitted a
   * scalar and the body fell back to bit indexing.
   */
  private static readonly ADD_RE = /^(\w+)\+(\w+)$/;
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
    const match = this.ADD_RE.exec(text);
    if (!match) {
      return undefined;
    }

    const left = this._resolveOperand(match[1], options);
    const right = this._resolveOperand(match[2], options);
    if (left !== undefined && right !== undefined) {
      return left + right;
    }
    return undefined;
  }

  /**
   * Resolve one operand of a constant expression.
   *
   * An operand is either an integer literal in any notation that
   * `LiteralUtils.parseIntegerLiteral` accepts (decimal, hex, binary) or the
   * name of a known const. Resolving both operand kinds in one place is what
   * lets `8+1`, `SIZE+1` and `SIZE+OFFSET` fold by the same rule.
   */
  private static _resolveOperand(
    text: string,
    options?: IConstantEvalOptions,
  ): number | undefined {
    const literal = LiteralUtils.parseIntegerLiteral(text);
    if (literal !== undefined) {
      return literal;
    }
    return options?.constValues?.get(text);
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
   * Iterate array dimensions with a callback for processing each.
   * Handles null/empty array check centrally.
   */
  private static forEachDimension(
    arrayDims: Parser.ArrayDimensionContext[] | null,
    processDim: (
      sizeExpr: Parser.ExpressionContext | null,
      dimensions: number[],
    ) => void,
  ): number[] {
    const dimensions: number[] = [];
    if (!arrayDims || arrayDims.length === 0) {
      return dimensions;
    }

    for (const dim of arrayDims) {
      processDim(dim.expression(), dimensions);
    }
    return dimensions;
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
    return ArrayDimensionParser.forEachDimension(
      arrayDims,
      (sizeExpr, dimensions) => {
        if (sizeExpr) {
          // Issue #1159: parseIntegerLiteral honours hex and binary notation.
          // Number.parseInt(text, 10) read "0x10" as 0 and "0b10000" as 0,
          // which silently disabled ADR-036 bounds checking for those arrays.
          const size = LiteralUtils.parseIntegerLiteral(sizeExpr.getText());
          if (size !== undefined && size > 0) {
            dimensions.push(size);
          }
        }
      },
    );
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
    return ArrayDimensionParser.forEachDimension(
      arrayDims,
      (sizeExpr, dimensions) => {
        if (sizeExpr) {
          // Issue #1159: parseIntegerLiteral honours hex and binary notation;
          // Number.parseInt(text, 10) read "0x10" as 0, which is indistinguishable
          // from a genuinely unresolved size.
          const size = LiteralUtils.parseIntegerLiteral(sizeExpr.getText());
          // Non-literal size (e.g. constant identifier) still counts the dimension
          dimensions.push(size ?? UNRESOLVED_DIMENSION);
        } else {
          // Unsized dimension (e.g. arr[]) - size is unknown
          dimensions.push(UNRESOLVED_DIMENSION);
        }
      },
    );
  }
}

export default ArrayDimensionParser;
