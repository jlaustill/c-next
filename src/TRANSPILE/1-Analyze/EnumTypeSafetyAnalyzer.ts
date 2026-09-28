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
 *
 * Every type -- a value's, a target's, a declaration's written type -- comes
 * from the one operand typer (#1668), and every assignment site is read, `for`
 * headers included (#1726).
 */

import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";

import { CNextListener } from "../../PARSE/2-Parse/grammar/CNextListener";
import * as Parser from "../../PARSE/2-Parse/grammar/CNextParser";
import ParserUtils from "../../utils/ParserUtils";
import OperandTyper from "../../utils/OperandTyper";
import EnumValueResolver from "./EnumValueResolver";
import BinaryOperatorLevelListener from "./BinaryOperatorLevelListener";
import AssignmentSiteListener from "./AssignmentSiteListener";
import IEnumTypeSafetyError from "./types/IEnumTypeSafetyError";
import type IAnalysisContext from "./types/IAnalysisContext";
import type IOperandType from "../../transpiler/types/IOperandType";
import type TAssignmentSite from "./types/TAssignmentSite";

const ASSIGN_HELP =
  "ADR-017: an enum is its own type, not an integer. Assign one of its members, or convert explicitly with a cast.";
const COMPARE_HELP =
  "ADR-017: an enum is its own type, not an integer. Compare it with a member of the same enum, or cast explicitly.";

class EnumTypeSafetyListener extends CNextListener {
  private readonly found: IEnumTypeSafetyError[] = [];

  public constructor(
    private readonly values: EnumValueResolver,
    private readonly context: IAnalysisContext,
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
    this.checkAssignment(
      OperandTyper.typeOfWritten(
        ctx.type(),
        this.context,
        ParserUtils.getPosition(ctx),
      ),
      expression,
    );
  };

  /** `s <- value;`, in a statement or a `for` header */
  public checkSite(site: TAssignmentSite): void {
    // Only a plain `<-` assigns a whole value. A compound operator on an enum
    // is E0857's business, and reporting both would be two diagnostics for one
    // mistake.
    if (!site.assignmentOperator().ASSIGN()) return;
    this.checkAssignment(
      OperandTyper.typeOfTarget(site.assignmentTarget(), this.context),
      site.expression(),
    );
  }

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
    target: IOperandType | null,
    expression: Parser.ExpressionContext,
  ): void {
    const targetKind = EnumValueResolver.kindOf(target);
    if (targetKind.kind !== "enum") return;
    const targetType = targetKind.typeName;

    const verdict = this.values.classify(expression);
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

  /** `a = b`, `a != b` and the relational operators */
  public checkComparison(operands: readonly ParserRuleContext[]): void {
    if (operands.length < 2) return;

    const left = this.values.classify(operands[0]);
    const right = this.values.classify(operands[1]);
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
  /** #1456: handed in rather than read off shared state. */
  constructor(private readonly context: IAnalysisContext) {}

  public analyze(tree: Parser.ProgramContext): IEnumTypeSafetyError[] {
    const listener = new EnumTypeSafetyListener(
      new EnumValueResolver(this.context),
      this.context,
    );
    // One walk for declarations, one per shared listener; reported in source
    // order, as the one walk these replace did
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    ParseTreeWalker.DEFAULT.walk(
      new BinaryOperatorLevelListener((operands, level) => {
        if (level === "equality" || level === "relational") {
          listener.checkComparison(operands);
        }
      }),
      tree,
    );
    ParseTreeWalker.DEFAULT.walk(
      new AssignmentSiteListener((site) => listener.checkSite(site)),
      tree,
    );
    return listener
      .errors()
      .sort((a, b) => a.line - b.line || a.column - b.column);
  }
}

export default EnumTypeSafetyAnalyzer;
