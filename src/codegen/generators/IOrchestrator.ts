/**
 * Interface that CodeGenerator implements to orchestrate generators.
 *
 * Provides:
 * - Access to read-only input and current state
 * - Effect processing to update mutable state
 * - Utility methods needed by generators
 *
 * This abstraction enables:
 * - Testing generators with mock orchestrators
 * - Gradual migration via "strangler fig" pattern
 */
import IGeneratorInput from "./IGeneratorInput";
import IGeneratorState from "./IGeneratorState";
import TGeneratorEffect from "./TGeneratorEffect";

// Import parser context types for expression generation methods
import * as Parser from "../../parser/grammar/CNextParser";
import { ParserRuleContext } from "antlr4ng";

interface IOrchestrator {
  // === State Access ===

  /** Get the immutable input context */
  getInput(): IGeneratorInput;

  /** Get a snapshot of the current generation state */
  getState(): IGeneratorState;

  // === Effect Processing ===

  /** Process effects returned by a generator, updating internal state */
  applyEffects(effects: readonly TGeneratorEffect[]): void;

  // === Utilities ===

  /** Get the current indentation string */
  getIndent(): string;

  /** Resolve an identifier to its fully-scoped name */
  resolveIdentifier(name: string): string;

  // === Expression Generation (ADR-053 A2) ===
  // These methods allow extracted generators to call back into CodeGenerator
  // for parts not yet extracted, enabling incremental "strangler fig" migration.

  /** Generate a C expression from any expression context */
  generateExpression(ctx: Parser.ExpressionContext): string;

  /** Generate type translation (C-Next type -> C type) */
  generateType(ctx: Parser.TypeContext): string;

  /** Generate a unary expression */
  generateUnaryExpr(ctx: Parser.UnaryExpressionContext): string;

  /** Generate a postfix expression */
  generatePostfixExpr(ctx: Parser.PostfixExpressionContext): string;

  /** Generate the full precedence chain from or-expression down */
  generateOrExpr(ctx: Parser.OrExpressionContext): string;

  // === Type Utilities ===

  /** Check if a type name is a known struct */
  isKnownStruct(typeName: string): boolean;

  /** Check if a type is a float type (f32, f64, float, double) */
  isFloatType(typeName: string): boolean;

  /** Check if a type is an integer type */
  isIntegerType(typeName: string): boolean;

  /** Check if a function is defined in C-Next (vs C headers) */
  isCNextFunction(name: string): boolean;

  // === Expression Analysis ===

  /** Get the enum type of an expression, if any */
  getExpressionEnumType(
    ctx: Parser.ExpressionContext | Parser.RelationalExpressionContext,
  ): string | null;

  /** Check if an expression is an integer literal or variable */
  isIntegerExpression(
    ctx: Parser.ExpressionContext | Parser.RelationalExpressionContext,
  ): boolean;

  /** Check if an expression is a string type */
  isStringExpression(ctx: Parser.RelationalExpressionContext): boolean;

  /** Get type of additive expression for shift validation */
  getAdditiveExpressionType(
    ctx: Parser.AdditiveExpressionContext,
  ): string | null;

  /** Extract operators from parse tree children in correct order */
  getOperatorsFromChildren(ctx: ParserRuleContext): string[];

  // === Validation ===

  /** Validate cross-scope member visibility (ADR-016) */
  validateCrossScopeVisibility(scopeName: string, memberName: string): void;

  /** Validate shift amount is within type bounds */
  validateShiftAmount(
    leftType: string,
    rightExpr: Parser.AdditiveExpressionContext,
    op: string,
    ctx: Parser.ShiftExpressionContext,
  ): void;
}

export default IOrchestrator;
