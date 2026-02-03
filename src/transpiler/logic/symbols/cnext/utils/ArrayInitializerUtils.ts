/**
 * ArrayInitializerUtils - Shared utilities for analyzing array initializers.
 * Issue #636: Used by both VariableCollector (headers) and CodeGenerator (.c files)
 * to ensure consistent array size inference from initializers.
 */

import * as Parser from "../../../parser/grammar/CNextParser";

class ArrayInitializerUtils {
  /**
   * Find an ArrayInitializerContext from an expression.
   * Traverses the parse tree: Expression → Ternary → Or → And → ... → Primary → ArrayInitializer
   *
   * @param expr The expression context to search
   * @returns The array initializer context, or null if not found
   */
  static findArrayInitializer(
    expr: Parser.ExpressionContext,
  ): Parser.ArrayInitializerContext | null {
    // Expression → TernaryExpression
    const ternary = expr.ternaryExpression();
    if (!ternary) return null;

    // TernaryExpression → OrExpression (when not a ternary)
    const orExpr = ternary.orExpression();
    if (!orExpr || orExpr.length === 0) return null;

    // OrExpression → AndExpression
    const andExpr = orExpr[0].andExpression();
    if (!andExpr || andExpr.length === 0) return null;

    // AndExpression → EqualityExpression
    const equality = andExpr[0].equalityExpression();
    if (!equality || equality.length === 0) return null;

    // EqualityExpression → RelationalExpression
    const relational = equality[0].relationalExpression();
    if (!relational || relational.length === 0) return null;

    // RelationalExpression → BitwiseOrExpression
    const bitwiseOr = relational[0].bitwiseOrExpression();
    if (!bitwiseOr || bitwiseOr.length === 0) return null;

    // BitwiseOrExpression → BitwiseXorExpression
    const bitwiseXor = bitwiseOr[0].bitwiseXorExpression();
    if (!bitwiseXor || bitwiseXor.length === 0) return null;

    // BitwiseXorExpression → BitwiseAndExpression
    const bitwiseAnd = bitwiseXor[0].bitwiseAndExpression();
    if (!bitwiseAnd || bitwiseAnd.length === 0) return null;

    // BitwiseAndExpression → ShiftExpression
    const shift = bitwiseAnd[0].shiftExpression();
    if (!shift || shift.length === 0) return null;

    // ShiftExpression → AdditiveExpression
    const additive = shift[0].additiveExpression();
    if (!additive || additive.length === 0) return null;

    // AdditiveExpression → MultiplicativeExpression
    const multiplicative = additive[0].multiplicativeExpression();
    if (!multiplicative || multiplicative.length === 0) return null;

    // MultiplicativeExpression → UnaryExpression
    const unaryArr = multiplicative[0].unaryExpression();
    if (!unaryArr || unaryArr.length === 0) return null;
    const unary = unaryArr[0];

    // UnaryExpression → PostfixExpression
    const postfix = unary.postfixExpression();
    if (!postfix) return null;

    // PostfixExpression → PrimaryExpression
    const primary = postfix.primaryExpression();
    if (!primary) return null;

    // PrimaryExpression → ArrayInitializer
    return primary.arrayInitializer();
  }

  /**
   * Count the number of elements in an array initializer.
   * Handles both list syntax [1, 2, 3] and fill-all syntax [0*].
   *
   * @param arrayInit The array initializer context
   * @returns Object with count (for list) or isFillAll (for fill-all syntax)
   */
  static countElements(arrayInit: Parser.ArrayInitializerContext): {
    count: number;
    isFillAll: boolean;
  } {
    // Check for fill-all syntax: [expr*]
    // Fill-all has expression() directly on the arrayInitializer, not wrapped in elements
    if (arrayInit.expression()) {
      return { count: 0, isFillAll: true };
    }

    // List syntax: [elem1, elem2, ...]
    const elements = arrayInit.arrayInitializerElement();
    return { count: elements.length, isFillAll: false };
  }

  /**
   * Get the inferred array size from an expression containing an array initializer.
   * Returns the element count if the expression is a list-style array initializer,
   * or undefined if no array initializer found or if it uses fill-all syntax.
   *
   * @param expr The expression context
   * @returns The inferred size, or undefined
   */
  static getInferredSize(expr: Parser.ExpressionContext): number | undefined {
    const arrayInit = this.findArrayInitializer(expr);
    if (!arrayInit) return undefined;

    const { count, isFillAll } = this.countElements(arrayInit);
    if (isFillAll) return undefined; // Fill-all requires explicit size

    return count > 0 ? count : undefined;
  }
}

export default ArrayInitializerUtils;
