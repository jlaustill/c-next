/**
 * ArrayDimensionParser - the single evaluator for array dimension expressions.
 *
 * Issue #644 extracted it from CodeGenerator; issue #1127 made it the only
 * place a dimension is decided. It lives in utils/ rather than output/ so the
 * symbol layer can reach it too -- `logic/` cannot import `output/`, and
 * collection folding fewer forms than codegen is what let the .c and the .h
 * disagree.
 *
 * Three rules hold across every entry point:
 *
 * 1. One evaluator. `parseSingleDimension` decides what an expression is
 *    worth; the other methods differ only in the shape of input they take
 *    (one expression, a dimension list) -- never in the answer.
 * 2. One lookup set. Callers pass `IConstantEvalOptions`, built by
 *    `dimensionEvalOptions()` in codegen and from the collection-time const
 *    map in the symbol layer. A caller that supplies fewer resolves fewer
 *    forms than its peers, which is a divergence waiting to happen.
 * 3. An unresolved dimension keeps its slot, as `UNRESOLVED_DIMENSION`.
 *    Dropping one shifts every dimension after it, so a subscript gets
 *    validated against the wrong bound.
 *
 * The string-level counterpart is `ArrayDimensionText`, for C and C++
 * declarators that arrive as text with no parse tree behind them.
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
  /** Same shape as ADD_RE for subtraction and multiplication. */
  private static readonly SUBTRACT_RE = /^(\w+)-(\w+)$/;
  private static readonly MULTIPLY_RE = /^(\w+)\*(\w+)$/;
  private static readonly DIVIDE_RE = /^(\w+)\/(\w+)$/;
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
    // Issue #1127: `+` alone was not enough. A dimension that does not fold is
    // carried as source text, and source text in a header is a C-Next name
    // that does not exist in C -- `u8[LOCAL*2]` reached the .h as
    // `uint8_t localMul[LOCAL*2]`, which fails to compile. Folding the common
    // const arithmetic removes the cases that actually occur; the residual
    // category is tracked separately.
    const operators: [RegExp, (a: number, b: number) => number][] = [
      [this.ADD_RE, (a, b) => a + b],
      [this.SUBTRACT_RE, (a, b) => a - b],
      [this.MULTIPLY_RE, (a, b) => a * b],
      // Integer division, matching C semantics for an array bound.
      [this.DIVIDE_RE, (a, b) => (b === 0 ? Number.NaN : Math.trunc(a / b))],
    ];

    for (const [pattern, apply] of operators) {
      const match = pattern.exec(text);
      if (!match) {
        continue;
      }
      const left = this._resolveOperand(match[1], options);
      const right = this._resolveOperand(match[2], options);
      if (left !== undefined && right !== undefined) {
        const value = apply(left, right);
        return Number.isNaN(value) ? undefined : value;
      }
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
      return this._evaluateSimpleSizeof(sizeofMatch[1], typeWidths);
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
  ): number | undefined {
    // Issue #1127: an isKnownStruct predicate used to be threaded in here to
    // distinguish "known struct, size not computable yet" from "unknown type".
    // Both returned undefined, so it changed no answer -- but it meant callers
    // supplied different option sets and agreed only because the difference was
    // inert, which is the divergence dimensionEvalOptions exists to prevent.
    const bitWidth = typeWidths[typeName];
    return bitWidth ? bitWidth / 8 : undefined;
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

    // Issue #1127: keep the slot, the same policy parseDimensions applies.
    // This filtered `size > 0` and so dropped an unresolved dimension, which
    // shifts every dimension after it -- `u8[2] x[EColor.COUNT]` recorded [2]
    // here and [2, UNRESOLVED_DIMENSION] through the sibling loop 15 lines
    // away that shares this evaluator. Inert today only because trailing
    // C-style dimensions are rejected later, which is agreement by
    // coincidence rather than one policy.
    const dimensions: number[] = [];
    for (const dim of arrayDims) {
      const sizeExpr = dim.expression();
      const size = sizeExpr
        ? ArrayDimensionParser.parseSingleDimension(sizeExpr, options)
        : undefined;
      dimensions.push(size ?? UNRESOLVED_DIMENSION);
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
   * Parse array dimensions, keeping one entry per dimension.
   *
   * Issue #1127: this replaces `parseSimpleDimensions` and
   * `parseForParameters`, which differed only in what they did with a
   * dimension that did not resolve -- one omitted it, the other recorded 0.
   * Omitting shifts every dimension after it out of position, so a subscript
   * gets validated against the wrong bound; that is the failure
   * `UNRESOLVED_DIMENSION` exists to prevent, and there is no context in which
   * omitting is the better answer. Two near-identical bodies with divergent
   * policies is also exactly the duplicate path this work set out to remove.
   *
   * @param arrayDims - The array dimension contexts to parse
   * @returns One entry per dimension: the literal value, or
   *          `UNRESOLVED_DIMENSION` when the size is not a literal (a const
   *          identifier, an expression) or the dimension is unsized (`arr[]`)
   */
  static parseDimensions(
    arrayDims: Parser.ArrayDimensionContext[] | null,
    options?: IConstantEvalOptions,
  ): number[] {
    return ArrayDimensionParser.forEachDimension(
      arrayDims,
      (sizeExpr, dimensions) => {
        // Issue #1127: takes the same options every other entry point takes.
        // Without them this was the one entry point that structurally could
        // not reach constValues or typeWidths, so `u8 buf[SIZE]` recorded
        // UNRESOLVED_DIMENSION while `u8[SIZE] buf` -- the other branch of the
        // very same function -- recorded 6.
        const size = sizeExpr
          ? ArrayDimensionParser.parseSingleDimension(sizeExpr, options)
          : undefined;
        dimensions.push(size ?? UNRESOLVED_DIMENSION);
      },
    );
  }
}

export default ArrayDimensionParser;
