/**
 * Expression Unwrapper Utility
 *
 * Navigates through the C-Next expression tree hierarchy to extract
 * inner expressions. The C-Next grammar has a deep expression hierarchy:
 *
 * expression -> ternary -> or -> and -> equality -> relational ->
 * bitwiseOr -> bitwiseXor -> bitwiseAnd -> shift -> additive ->
 * multiplicative -> unary -> postfix
 *
 * This utility extracts inner expressions when they are "simple" (single term
 * at each level), returning null if any level has multiple terms (indicating
 * a binary operation at that level).
 *
 * Issue #707: Extracted from CodeGenerator.ts and TypeResolver.ts to
 * eliminate code duplication.
 */

import * as Parser from "../PARSE/2-Parse/grammar/CNextParser";

/**
 * An identifier with exactly one subscript applied, and that subscript's
 * index expressions.
 *
 * Declared here rather than in `src/transpiler/types/`: it names a parse
 * context, and a type file that does so JOINS the population
 * `parse-tree-confined-to-parser` gates (#1317). This module is already in it,
 * so the shape costs nothing where it is.
 */
interface ISubscriptedIdentifier {
  readonly name: string;
  /**
   * One expression for `s[i]`, two for `s[i, n]` -- the grammar allows no
   * other arity.
   */
  readonly indexes: readonly Parser.ExpressionContext[];
}

/**
 * Utility class for navigating expression tree hierarchy
 */
class ExpressionUnwrapper {
  /**
   * Navigate from ExpressionContext to ShiftExpressionContext.
   * This is the common navigation path shared by getPostfixExpression,
   * getUnaryExpression, and getAdditiveExpression.
   *
   * Returns null if expression has multiple terms at any level above shift.
   */
  private static navigateToShift(
    ctx: Parser.ExpressionContext,
  ): Parser.ShiftExpressionContext | null {
    const ternary = ctx.ternaryExpression();
    const orExprs = ternary.orExpression();
    // If it's a ternary (3 orExpressions), we can't get a single expression
    if (orExprs.length !== 1) return null;

    const or = orExprs[0];
    if (or.andExpression().length !== 1) return null;

    const and = or.andExpression()[0];
    if (and.equalityExpression().length !== 1) return null;

    const eq = and.equalityExpression()[0];
    if (eq.relationalExpression().length !== 1) return null;

    const rel = eq.relationalExpression()[0];
    if (rel.bitwiseOrExpression().length !== 1) return null;

    const bor = rel.bitwiseOrExpression()[0];
    if (bor.bitwiseXorExpression().length !== 1) return null;

    const bxor = bor.bitwiseXorExpression()[0];
    if (bxor.bitwiseAndExpression().length !== 1) return null;

    const band = bxor.bitwiseAndExpression()[0];
    if (band.shiftExpression().length !== 1) return null;

    return band.shiftExpression()[0];
  }

  /**
   * Navigate from ExpressionContext to UnaryExpressionContext.
   * Common helper for getPostfixExpression and getUnaryExpression.
   *
   * Returns null if expression has multiple terms at any level.
   */
  private static navigateToUnary(
    ctx: Parser.ExpressionContext,
  ): Parser.UnaryExpressionContext | null {
    const shift = this.navigateToShift(ctx);
    if (!shift) return null;

    if (shift.additiveExpression().length !== 1) return null;

    const add = shift.additiveExpression()[0];
    if (add.multiplicativeExpression().length !== 1) return null;

    const mult = add.multiplicativeExpression()[0];
    if (mult.unaryExpression().length !== 1) return null;

    return mult.unaryExpression()[0];
  }

  /**
   * Navigate from ExpressionContext to PostfixExpressionContext.
   * Returns null if the expression has multiple terms at any level
   * (indicating binary operations).
   *
   * Use this when you need to access the postfix expression for:
   * - Getting the primary expression (identifier, literal)
   * - Checking postfix operators (member access, array indexing)
   */
  static getPostfixExpression(
    ctx: Parser.ExpressionContext,
  ): Parser.PostfixExpressionContext | null {
    const unary = this.navigateToUnary(ctx);
    if (!unary?.postfixExpression()) return null;
    return unary.postfixExpression()!;
  }

  /**
   * Navigate from ExpressionContext to UnaryExpressionContext.
   * Returns null if the expression has multiple terms at any level.
   *
   * Use this when you need access to unary operators (!, -, ~, etc.)
   */
  static getUnaryExpression(
    ctx: Parser.ExpressionContext,
  ): Parser.UnaryExpressionContext | null {
    return this.navigateToUnary(ctx);
  }

  /**
   * Navigate from ExpressionContext to AdditiveExpressionContext.
   * Returns null if the expression has multiple terms at outer levels.
   *
   * Use this when you need to check for additive operations (+, -)
   */
  static getAdditiveExpression(
    ctx: Parser.ExpressionContext,
  ): Parser.AdditiveExpressionContext | null {
    const shift = this.navigateToShift(ctx);
    if (!shift) return null;

    if (shift.additiveExpression().length !== 1) return null;

    return shift.additiveExpression()[0];
  }

  /**
   * Extract a simple identifier from an expression.
   * Returns the identifier name if the expression is a simple variable
   * reference with no postfix operators (member access, indexing).
   * Returns null for complex expressions.
   *
   * Use this for cases like:
   * - Checking if an expression is a specific variable
   * - Parameter lookup
   * - Simple variable references
   */
  static getSimpleIdentifier(ctx: Parser.ExpressionContext): string | null {
    const postfix = this.getPostfixExpression(ctx);
    if (!postfix) return null;

    const ops = postfix.postfixOp();
    // Must have no postfix operations (no member access, no indexing)
    if (ops.length !== 0) return null;

    const primary = postfix.primaryExpression();
    const id = primary.IDENTIFIER();
    return id ? id.getText() : null;
  }

  /**
   * Check if an expression is a simple identifier (variable reference).
   * Convenience method for boolean checks.
   */
  static isSimpleIdentifier(ctx: Parser.ExpressionContext): boolean {
    return this.getSimpleIdentifier(ctx) !== null;
  }

  /**
   * The two operand texts of a two-operand `+`, or null for anything else.
   *
   * #1445: lifted out of `StringOperationsHelper`, whose ADR-045 concatenation
   * check was the only caller and which now names no parse type. The operands
   * come back as SOURCE TEXT because that is what its question needs -- a
   * string literal's length and a declared string's capacity are both answered
   * from the name, not from generated code.
   *
   * Subtraction is rejected on the MINUS token rather than on the text. An
   * identifier or a string literal may contain a hyphen, so a
   * `getText().includes("-")` test reads `str + "hello-world"` as a
   * subtraction and silently declines to concatenate it.
   */
  static getAdditionOperandTexts(
    ctx: Parser.ExpressionContext,
  ): readonly [string, string] | null {
    const add = this.getAdditiveExpression(ctx);
    if (!add) return null;

    const operands = add.multiplicativeExpression();
    if (operands.length !== 2 || add.MINUS().length > 0) return null;

    return [operands[0].getText(), operands[1].getText()];
  }

  /**
   * An identifier with exactly one subscript applied: `s[i]` or `s[i, n]`.
   *
   * The sibling of `getSimpleIdentifier`, which answers the no-suffix case.
   *
   * `postfixOp` has four shapes and only the two subscripts carry expressions
   * -- a member access carries an IDENTIFIER and a call carries an
   * argumentList -- so an empty index list is an exact discriminator rather
   * than a heuristic, and `f()[0]` is excluded by the primary not being an
   * identifier.
   *
   * The indexes come back as NODES, not generated code, because generating one
   * is not free: it can allocate a C++ temp and queue its declaration, so a
   * caller that may discard them has to decide before it pays. ADR-045's
   * substring extraction asks the source's capacity first for exactly that
   * reason.
   */
  static getSubscriptedIdentifier(
    ctx: Parser.ExpressionContext,
  ): ISubscriptedIdentifier | null {
    const postfix = this.getPostfixExpression(ctx);
    if (!postfix) return null;

    const ops = postfix.postfixOp();
    if (ops.length !== 1) return null;

    const id = postfix.primaryExpression().IDENTIFIER();
    const indexes = ops[0].expression();
    if (!id || indexes.length === 0) return null;

    return { name: id.getText(), indexes };
  }
}

export default ExpressionUnwrapper;
