/**
 * ADR-017 enum type safety: E0428 (assignment) and E0434 (comparison).
 *
 * #1322. This replaces EIGHT throws in `output/` -- five in
 * `EnumAssignmentValidator` and three in `BinaryExprUtils` -- all driven by one
 * 248-line resolver that answered "what enum type is this expression?" by
 * splitting the expression's SOURCE TEXT on `.`.
 *
 * ## The three fallbacks were one decision
 *
 * `Cannot assign non-enum value to T enum` was thrown from three arms, each
 * reached by a different shape of dotted text: a `this.` path, a path of three
 * or more components, and a path of two. They are not three rules. They are one
 * rule -- the value is not of the target enum type -- reached after the text
 * split failed to prove otherwise. Written as one question about a resolved
 * type, the arms disappear.
 *
 * ## The holes that asking about characters left
 *
 * The text split could only recognize what it had patterns for, so everything
 * else fell through as accepted. Verified by probe, each of these compiled and
 * emitted C:
 *
 *     State a <- flag;      // a bool
 *     State b <- x;         // an f32
 *     State c <- f();       // a call returning u32
 *     State d <- 1 + 1;     // emitted `State d = 2;`
 *
 * The last is the sharpest: ADR-017 lists `s <- 1;` as an ERROR, and the only
 * reason `1 + 1` was not one is that the check matched the source text against a pattern for a
 * bare integer literal while constant folding happens later, in codegen. A
 * rule with a hole is worse than no rule, because people trust it.
 *
 * Resolving the value's declared TYPE instead closes all four, and closes them
 * the same way, because they were never four cases.
 *
 * ## Why it does not reject what it cannot resolve
 *
 * An unresolved name is another diagnostic's to report -- E0427 already does --
 * so an unresolvable value is passed over rather than guessed at. That is the
 * same conservatism `CompoundAssignmentAnalyzer` needed, and for the same
 * reason: the alternative is a diagnostic that fires on valid code whenever the
 * resolver has a gap.
 */

import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";

import { CNextListener } from "../../transpiler/logic/parser/grammar/CNextListener";
import * as Parser from "../../transpiler/logic/parser/grammar/CNextParser";
import CodeGenState from "../../transpiler/state/CodeGenState";
import ParserUtils from "../../utils/ParserUtils";
import DeclarationScopeCollector from "./DeclarationScopeCollector";
import EnumValueResolver from "./EnumValueResolver";
import IEnumTypeSafetyError from "./types/IEnumTypeSafetyError";
import IScopeFrame from "./types/IScopeFrame";
import OperandTypeResolver from "./OperandTypeResolver";
import ScopeFrameResolver from "./ScopeFrameResolver";

const ASSIGN_HELP =
  "ADR-017: an enum is its own type, not an integer. Assign one of its members, or convert explicitly with a cast.";
const COMPARE_HELP =
  "ADR-017: an enum is its own type, not an integer. Compare it with a member of the same enum, or cast explicitly.";

class EnumTypeSafetyListener extends CNextListener {
  private readonly found: IEnumTypeSafetyError[] = [];

  public constructor(
    private readonly scopes: ScopeFrameResolver,
    private readonly values: EnumValueResolver,
  ) {
    super();
  }

  public errors(): IEnumTypeSafetyError[] {
    return this.found;
  }

  /** `State s <- value;` -- the declared type names the target. */
  override enterVariableDeclaration = (
    ctx: Parser.VariableDeclarationContext,
  ): void => {
    const expression = ctx.expression();
    if (!expression) return;

    const frame = this.scopes.frameFor(ctx);
    // The declared type is normalized by the same resolver the VALUE side uses,
    // so `this.EMode` and a bare `EMode` cannot arrive as two different names.
    const written = ctx.type().getText();
    this.checkAssignment(
      this.values.enumTypeNameFor(written, frame) ?? written,
      expression,
      frame,
    );
  };

  /** `s <- value;` -- the target's declared type has to be resolved. */
  override enterAssignmentStatement = (
    ctx: Parser.AssignmentStatementContext,
  ): void => {
    // Only a plain `<-` assigns a whole value. A compound operator on an enum
    // is E0857's business, and reporting both would be two diagnostics for one
    // mistake.
    if (!ctx.assignmentOperator().ASSIGN()) return;

    const expression = ctx.expression();
    if (!expression) return;

    const frame = this.scopes.frameFor(ctx);
    const target = new OperandTypeResolver(this.scopes).typeOfAssignmentTarget(
      ctx.assignmentTarget(),
      frame,
    );
    if (target === null) return;
    this.checkAssignment(target, expression, frame);
  };

  /** `a = b`, `a != b` and the relational operators. */
  override enterEqualityExpression = (
    ctx: Parser.EqualityExpressionContext,
  ): void => {
    this.checkComparison(ctx, ctx.relationalExpression());
  };

  override enterRelationalExpression = (
    ctx: Parser.RelationalExpressionContext,
  ): void => {
    this.checkComparison(ctx, ctx.bitwiseOrExpression());
  };

  /**
   * How a classified operand is named in a message.
   *
   * #1322 review: this mapping was written twice in this file -- once in the
   * assignment path, once as a local arrow in the comparison path -- so the
   * two messages were free to drift into describing one verdict differently.
   */
  private static describe(
    verdict: ReturnType<EnumValueResolver["classify"]>,
  ): string {
    if (verdict.kind === "enum") return `${verdict.typeName} enum`;
    if (verdict.kind === "integer") return "integer";
    return "non-enum value";
  }

  private checkAssignment(
    targetType: string,
    expression: Parser.ExpressionContext,
    frame: IScopeFrame,
  ): void {
    if (!CodeGenState.isKnownEnum(targetType)) return;

    const verdict = this.values.classify(expression, frame);
    if (
      verdict.kind === "unresolved" &&
      !this.values.isPureMemberPath(expression)
    ) {
      return;
    }
    if (verdict.kind === "enum" && verdict.typeName === targetType) return;

    const what = EnumTypeSafetyListener.describe(verdict);

    const { line, column } = ParserUtils.getPosition(expression);
    this.found.push({
      code: "E0428",
      line,
      column,
      message: `Cannot assign ${what} to ${targetType} enum`,
      helpText: ASSIGN_HELP,
    });
  }

  private checkComparison(
    ctx: ParserRuleContext,
    operands: readonly ParserRuleContext[],
  ): void {
    if (operands.length < 2) return;

    const frame = this.scopes.frameFor(ctx);
    const left = this.values.classify(operands[0], frame);
    const right = this.values.classify(operands[1], frame);
    if (left.kind === "unresolved" || right.kind === "unresolved") return;
    if (left.kind !== "enum" && right.kind !== "enum") return;
    if (
      left.kind === "enum" &&
      right.kind === "enum" &&
      left.typeName === right.typeName
    ) {
      return;
    }

    const { line, column } = ParserUtils.getPosition(operands[1]);
    this.found.push({
      code: "E0434",
      line,
      column,
      message: `Cannot compare ${EnumTypeSafetyListener.describe(left)} to ${EnumTypeSafetyListener.describe(right)}`,
      helpText: COMPARE_HELP,
    });
  }
}

class EnumTypeSafetyAnalyzer {
  public analyze(tree: Parser.ProgramContext): IEnumTypeSafetyError[] {
    const declarations = new DeclarationScopeCollector();
    ParseTreeWalker.DEFAULT.walk(declarations, tree);

    const scopes = new ScopeFrameResolver(declarations);
    const listener = new EnumTypeSafetyListener(
      scopes,
      new EnumValueResolver(scopes),
    );
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default EnumTypeSafetyAnalyzer;
