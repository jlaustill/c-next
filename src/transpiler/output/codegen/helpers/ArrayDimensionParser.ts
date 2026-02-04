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
    const constValues = options?.constValues;
    const typeWidths = options?.typeWidths;
    const isKnownStruct = options?.isKnownStruct;

    // First, try parsing as a simple integer literal using LiteralUtils
    const literalValue = LiteralUtils.parseIntegerLiteral(text);
    if (literalValue !== undefined) {
      return literalValue;
    }

    // Check if it's a known const value (identifier)
    if (constValues && /^[a-zA-Z_]\w*$/.test(text)) {
      const constValue = constValues.get(text);
      if (constValue !== undefined) {
        return constValue;
      }
    }

    // Handle simple binary expressions with const values (e.g., INDEX_1 + INDEX_1)
    if (constValues) {
      const addMatch = /^([a-zA-Z_]\w*)\+([a-zA-Z_]\w*)$/.exec(text);
      if (addMatch) {
        const left = constValues.get(addMatch[1]);
        const right = constValues.get(addMatch[2]);
        if (left !== undefined && right !== undefined) {
          return left + right;
        }
      }
    }

    // Handle sizeof(type) expressions for primitive types
    if (typeWidths) {
      const sizeofMatch = /^sizeof\(([a-zA-Z_]\w*)\)$/.exec(text);
      if (sizeofMatch) {
        const typeName = sizeofMatch[1];
        const bitWidth = typeWidths[typeName];
        if (bitWidth) {
          return bitWidth / 8; // Convert bits to bytes
        }
        // Check if it's a known struct - can't compute size at this point
        if (isKnownStruct?.(typeName)) {
          return undefined;
        }
      }

      // Handle sizeof(type) * N expressions
      const sizeofMulMatch = /^sizeof\(([a-zA-Z_]\w*)\)\*(\d+)$/.exec(text);
      if (sizeofMulMatch) {
        const typeName = sizeofMulMatch[1];
        const multiplier = Number.parseInt(sizeofMulMatch[2], 10);
        const bitWidth = typeWidths[typeName];
        if (bitWidth && !Number.isNaN(multiplier)) {
          return (bitWidth / 8) * multiplier;
        }
      }

      // Handle sizeof(type) + N expressions
      const sizeofAddMatch = /^sizeof\(([a-zA-Z_]\w*)\)\+(\d+)$/.exec(text);
      if (sizeofAddMatch) {
        const typeName = sizeofAddMatch[1];
        const addend = Number.parseInt(sizeofAddMatch[2], 10);
        const bitWidth = typeWidths[typeName];
        if (bitWidth && !Number.isNaN(addend)) {
          return bitWidth / 8 + addend;
        }
      }
    }

    // For more complex expressions, we can't evaluate at compile time
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
    if (!arrayDims || arrayDims.length === 0) {
      return dimensions;
    }

    for (const dim of arrayDims) {
      const sizeExpr = dim.expression();
      if (sizeExpr) {
        const size = Number.parseInt(sizeExpr.getText(), 10);
        if (!Number.isNaN(size) && size > 0) {
          dimensions.push(size);
        }
      }
    }
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
    if (!arrayDims || arrayDims.length === 0) {
      return dimensions;
    }

    for (const dim of arrayDims) {
      const sizeExpr = dim.expression();
      if (sizeExpr) {
        const sizeText = sizeExpr.getText();
        const size = Number.parseInt(sizeText, 10);
        if (Number.isNaN(size)) {
          // Non-numeric size (e.g., constant identifier) - still count the dimension
          dimensions.push(0);
        } else {
          dimensions.push(size);
        }
      } else {
        // Unsized dimension (e.g., arr[]) - use 0 to indicate unknown size
        dimensions.push(0);
      }
    }
    return dimensions;
  }
}

export default ArrayDimensionParser;
