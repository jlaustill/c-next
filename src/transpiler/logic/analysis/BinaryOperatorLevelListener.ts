/**
 * Binary Operator Level Listener
 *
 * Walks every binary-operator level of the expression grammar and hands each
 * one's operand list to a callback, so an analyzer that inspects operand pairs
 * states only WHICH levels its rule governs and WHAT to check -- never the
 * grammar wiring itself.
 *
 * That wiring (which rule is a binary-operator level, and which child rule
 * supplies its operands) is a single fact about the grammar. Before this
 * existed, MixedTypeCategoryAnalyzer and BooleanOperandAnalyzer each carried a
 * copy of it, so adding a level meant editing both (Issue #1183).
 *
 * A level with fewer than two operands is not an operator application at all --
 * the grammar collapses to a single pass-through child -- so it is not
 * dispatched.
 */

import { ParserRuleContext } from "antlr4ng";
import { CNextListener } from "../parser/grammar/CNextListener";
import * as Parser from "../parser/grammar/CNextParser";
import TBinaryOperatorLevel from "./types/TBinaryOperatorLevel";

/**
 * Receives one binary-operator level: its operands in source order, and which
 * level produced them.
 */
type TLevelHandler = (
  operands: ParserRuleContext[],
  level: TBinaryOperatorLevel,
) => void;

class BinaryOperatorLevelListener extends CNextListener {
  private readonly onLevel: TLevelHandler;

  constructor(onLevel: TLevelHandler) {
    super();
    this.onLevel = onLevel;
  }

  private dispatch(
    operands: ParserRuleContext[],
    level: TBinaryOperatorLevel,
  ): void {
    if (operands.length < 2) return;
    this.onLevel(operands, level);
  }

  override enterMultiplicativeExpression = (
    ctx: Parser.MultiplicativeExpressionContext,
  ): void => {
    this.dispatch(ctx.unaryExpression(), "multiplicative");
  };

  override enterAdditiveExpression = (
    ctx: Parser.AdditiveExpressionContext,
  ): void => {
    this.dispatch(ctx.multiplicativeExpression(), "additive");
  };

  override enterShiftExpression = (
    ctx: Parser.ShiftExpressionContext,
  ): void => {
    this.dispatch(ctx.additiveExpression(), "shift");
  };

  override enterBitwiseAndExpression = (
    ctx: Parser.BitwiseAndExpressionContext,
  ): void => {
    this.dispatch(ctx.shiftExpression(), "bitwiseAnd");
  };

  override enterBitwiseXorExpression = (
    ctx: Parser.BitwiseXorExpressionContext,
  ): void => {
    this.dispatch(ctx.bitwiseAndExpression(), "bitwiseXor");
  };

  override enterBitwiseOrExpression = (
    ctx: Parser.BitwiseOrExpressionContext,
  ): void => {
    this.dispatch(ctx.bitwiseXorExpression(), "bitwiseOr");
  };

  override enterRelationalExpression = (
    ctx: Parser.RelationalExpressionContext,
  ): void => {
    this.dispatch(ctx.bitwiseOrExpression(), "relational");
  };

  override enterEqualityExpression = (
    ctx: Parser.EqualityExpressionContext,
  ): void => {
    this.dispatch(ctx.relationalExpression(), "equality");
  };
}

export default BinaryOperatorLevelListener;
