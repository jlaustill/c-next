/**
 * StringOperationsHelper - String operation detection and extraction
 *
 * Extracted from CodeGenerator to reduce file size.
 * Handles detection of string concatenation and substring patterns.
 *
 * ADR-045: String type support
 * Issue #707: Uses ExpressionUnwrapper for tree navigation
 */

import * as Parser from "../../../logic/parser/grammar/CNextParser.js";
import CodeGenState from "../../../state/CodeGenState.js";
import StringUtils from "../../../../utils/StringUtils.js";
import ExpressionUnwrapper from "../../../../utils/ExpressionUnwrapper";

/** Regex for identifying valid C/C++ identifiers */
const IDENTIFIER_REGEX = /^[a-zA-Z_]\w*$/;

/**
 * String concatenation operands extracted from expression.
 */
interface IStringConcatOps {
  left: string;
  right: string;
  leftCapacity: number;
  rightCapacity: number;
}

/**
 * Substring extraction operands extracted from expression.
 */
interface ISubstringOps {
  source: string;
  start: string;
  length: string;
  sourceCapacity: number;
}

/**
 * Callbacks for substring operand extraction.
 */
interface ISubstringCallbacks {
  /** Generate expression code */
  generateExpression: (ctx: Parser.ExpressionContext) => string;
}

/**
 * Helper for string operation detection and extraction.
 * All methods are static - uses CodeGenState for shared state.
 */
class StringOperationsHelper {
  // ========================================================================
  // Tier 1: Pure Utilities (no callbacks needed)
  // ========================================================================

  /**
   * Get the capacity of a string expression.
   * For string literals, capacity equals content length.
   * For string variables, capacity is from the type registry.
   *
   * ADR-045: String capacity resolution for concatenation and bounds checking.
   *
   * @param exprCode - Expression code text (e.g., "hello" or varName)
   * @returns Capacity in characters, or null if not a string
   */
  static getStringExprCapacity(exprCode: string): number | null {
    // String literal - capacity equals content length
    if (exprCode.startsWith('"') && exprCode.endsWith('"')) {
      return StringUtils.literalLength(exprCode);
    }

    // Variable - check type registry
    if (IDENTIFIER_REGEX.test(exprCode)) {
      const typeInfo = CodeGenState.getVariableTypeInfo(exprCode);
      if (typeInfo?.isString && typeInfo.stringCapacity !== undefined) {
        return typeInfo.stringCapacity;
      }
    }

    return null;
  }

  /**
   * Check if an expression is a string concatenation (contains + with string operands).
   * Returns the operand expressions and capacities if it is, null otherwise.
   *
   * ADR-045: String concatenation detection for strncpy/strncat generation.
   * Issue #707: Uses ExpressionUnwrapper for tree navigation.
   *
   * @param ctx - Expression context to check
   * @returns Concatenation operands or null if not a string concat
   */
  static getStringConcatOperands(
    ctx: Parser.ExpressionContext,
  ): IStringConcatOps | null {
    // Navigate to the additive expression level using ExpressionUnwrapper
    const add = ExpressionUnwrapper.getAdditiveExpression(ctx);
    if (!add) return null;
    const multExprs = add.multiplicativeExpression();

    // Need exactly 2 operands for simple concatenation
    if (multExprs.length !== 2) return null;

    // Check if this is addition (not subtraction)
    // Use MINUS() token check instead of text.includes("-") to avoid
    // false positives from identifiers/literals containing hyphens
    if (add.MINUS().length > 0) return null;

    // Get the operand texts
    const leftText = multExprs[0].getText();
    const rightText = multExprs[1].getText();

    // Check if at least one operand is a string
    const leftCapacity = StringOperationsHelper.getStringExprCapacity(leftText);
    const rightCapacity =
      StringOperationsHelper.getStringExprCapacity(rightText);

    if (leftCapacity === null && rightCapacity === null) {
      return null; // Neither is a string
    }

    // If one is null, it's not a valid string concatenation
    if (leftCapacity === null || rightCapacity === null) {
      return null;
    }

    return {
      left: leftText,
      right: rightText,
      leftCapacity,
      rightCapacity,
    };
  }

  // ========================================================================
  // Tier 2: Operations with Callbacks
  // ========================================================================

  /**
   * Check if an expression is a substring extraction (string[start, length]).
   * Returns the source string, start, length, and source capacity if it is.
   *
   * ADR-045: Substring extraction detection for safe string slicing.
   * Issue #707: Uses ExpressionUnwrapper for tree navigation.
   * Issue #140: Handles both [start, length] and single-char [index] patterns.
   *
   * @param ctx - Expression context to check
   * @param callbacks - Callbacks for expression generation
   * @returns Substring operands or null if not a substring extraction
   */
  static getSubstringOperands(
    ctx: Parser.ExpressionContext,
    callbacks: ISubstringCallbacks,
  ): ISubstringOps | null {
    // Navigate to the postfix expression level using shared utility
    const postfix = ExpressionUnwrapper.getPostfixExpression(ctx);
    if (!postfix) return null;

    const primary = postfix.primaryExpression();
    const ops = postfix.postfixOp();

    // Need exactly one postfix operation (the [start, length])
    if (ops.length !== 1) return null;

    const op = ops[0];
    const exprs = op.expression();

    // Get the source variable name first
    const sourceId = primary.IDENTIFIER();
    if (!sourceId) return null;

    const sourceName = sourceId.getText();

    // Check if source is a string type
    const typeInfo = CodeGenState.getVariableTypeInfo(sourceName);
    if (!typeInfo?.isString || typeInfo.stringCapacity === undefined) {
      return null;
    }

    // Issue #140: Handle both [start, length] pattern (2 expressions)
    // and single-character access [index] pattern (1 expression, treated as [index, 1])
    if (exprs.length === 2) {
      return {
        source: sourceName,
        start: callbacks.generateExpression(exprs[0]),
        length: callbacks.generateExpression(exprs[1]),
        sourceCapacity: typeInfo.stringCapacity,
      };
    } else if (exprs.length === 1) {
      // Single-character access: source[i] is sugar for source[i, 1]
      return {
        source: sourceName,
        start: callbacks.generateExpression(exprs[0]),
        length: "1",
        sourceCapacity: typeInfo.stringCapacity,
      };
    }

    return null;
  }
}

export default StringOperationsHelper;
