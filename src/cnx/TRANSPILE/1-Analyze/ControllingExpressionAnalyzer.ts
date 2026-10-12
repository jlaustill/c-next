/**
 * ADR-022's controlling-expression rule: E0701 and E0702.
 *
 * #1322. Four throws in `TypeValidator`, all reaching the user as `1:0`, across
 * nineteen fixtures that assert that position.
 *
 * The rule itself is purely SYNTACTIC -- every leaf operand of a controlling
 * expression, after decomposing `||` and `&&`, must be an equality or
 * relational comparison. It reads the parse tree and nothing else, which makes
 * this the second family in a row that needed no capability 2.1 did not already
 * have. Only the help text asks a type question, and it asks it of the lexical
 * frames rather than of codegen's registry.
 *
 * ## The enumeration, named because it is the risk
 *
 * Five productions carry a controlling expression: `if`, `while`, `do-while`,
 * `for` and the ternary. There is no way to ask the grammar "which rules have
 * one" -- they are five listener methods, and a sixth production added later
 * would be silently unchecked. That is exactly how E0853 came to miss `switch`.
 *
 * Two things are done about it rather than hoped about it. The five delegate to
 * ONE check, so only the collection is enumerated and never the decision. And
 * `controlling-expression-every-kind-error` exercises all five in one file, so
 * its expected output carries five diagnostics: a kind that stops being visited
 * drops the count and fails the fixture. `forever` is deliberately absent from
 * the list -- it has no controlling expression, which is the point of it.
 */

import ExpressionCalls from "../../utils/ExpressionCalls";
import OperandTyper from "../../utils/OperandTyper";
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionNodes from "../../utils/ExpressionNodes";
import StatementNodes from "../../utils/StatementNodes";
import IControllingExpressionError from "./types/IControllingExpressionError";
import type IAnalysisContext from "./types/IAnalysisContext";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TExpression from "../../types/syntax/TExpression";
import type TStatement from "../../types/syntax/TStatement";

const CALL_HELP = "Store the function result in a variable first.";

class ControllingExpressionCheck {
  private readonly found: IControllingExpressionError[] = [];

  public constructor(private readonly context: IAnalysisContext) {}

  public errors(): IControllingExpressionError[] {
    return this.found;
  }

  // --- The places that carry a controlling expression -----------------------
  // Each one only NAMES its expression; the rule itself lives in `check`.

  public checkStatement(statement: TStatement): void {
    switch (statement.kind) {
      case "if":
        this.check(statement.condition, "if");
        return;
      case "while":
        this.check(statement.condition, "while");
        return;
      case "doWhile":
        this.check(statement.condition, "do-while");
        return;
      case "for":
        // `for (;;)` has no controlling expression at all -- that is E0707's
        // case (a disguised infinite loop), not this rule's.
        if (statement.condition) this.check(statement.condition, "for");
        return;
      default:
        return;
    }
  }

  public checkTernary(expr: TExpression): void {
    if (expr.kind !== "ternary") return;
    if (ExpressionCalls.callsAtTop(expr.condition)) {
      this.reportCall(expr.condition, "ternary");
      return;
    }
    this.checkComparison(expr.condition, "ternary");
  }

  // --- The one decision -----------------------------------------------------

  private check(expr: TExpression, kind: string): void {
    if (ExpressionCalls.callsAtTop(expr)) {
      this.reportCall(expr, kind);
      return;
    }

    if (expr.kind === "ternary") {
      this.found.push({
        code: "E0701",
        line: expr.span.line,
        column: expr.span.column,
        message: `${kind} condition must be a comparison, not a ternary`,
        helpText:
          "MISRA C:2012 Rule 14.4: lift the ternary into a variable and compare that.",
      });
      return;
    }

    this.checkComparison(expr, kind);
  }

  /**
   * Every leaf operand, after decomposing `||` and `&&`, has to carry a
   * comparison operator of its own; the first that does not is reported.
   *
   * A bare value, a bare bool, a literal or a negation is rejected: `!ready` is
   * not a comparison, and MISRA C:2012 Rule 14.4 wants the intent written out.
   */
  private checkComparison(expr: TExpression, kind: string): void {
    const leaf = ControllingExpressionCheck.leaves(expr).find(
      (operand) =>
        operand.kind !== "binary" ||
        (operand.level !== "equality" && operand.level !== "relational"),
    );
    if (leaf !== undefined) this.reportNotComparison(leaf, kind);
  }

  /** The operands `||` and `&&` join, left to right */
  private static leaves(expr: TExpression): readonly TExpression[] {
    if (
      expr.kind === "binary" &&
      (expr.level === "or" || expr.level === "and")
    ) {
      return expr.operands.flatMap((operand) =>
        ControllingExpressionCheck.leaves(operand),
      );
    }
    return [expr];
  }

  private reportNotComparison(node: TExpression, kind: string): void {
    this.found.push({
      code: "E0701",
      line: node.span.line,
      column: node.span.column,
      message: `${kind} condition must be a comparison, not '${node.written}'`,
      helpText: `MISRA C:2012 Rule 14.4: ${this.suggestionFor(node)}`,
    });
  }

  private reportCall(node: TExpression, kind: string): void {
    this.found.push({
      code: "E0702",
      line: node.span.line,
      column: node.span.column,
      message: `${kind} condition may not call a function: '${node.written}'`,
      helpText: `MISRA C:2012 Rule 13.5: ${CALL_HELP}`,
    });
  }

  /**
   * What to write instead.
   *
   * A `bool` gets `x = true` and anything else gets `x > 0`, so the suggestion
   * is asked of the operand's DECLARED type. It reads the lexical frames rather
   * than codegen's type registry -- the registry does not exist yet when this
   * pass runs, and the frames also honour shadowing, which the registry's flat
   * name lookup does not.
   */
  private suggestionFor(node: TExpression): string {
    const negated = node.kind === "unary" && node.operator === "!";
    const base = negated ? node.operand.written : node.written;
    if (
      OperandTyper.isBoolean(
        OperandTyper.typeOfName(base, node.span, this.context),
      )
    ) {
      return `write it out, e.g. ${base} = ${negated ? "false" : "true"}`;
    }
    return `write it out, e.g. ${node.written} > 0 or ${node.written} != 0`;
  }
}

class ControllingExpressionAnalyzer {
  /** #1456: handed in rather than read off shared state. */
  constructor(private readonly context: IAnalysisContext) {}

  public analyze(program: IProgramSyntax): IControllingExpressionError[] {
    const check = new ControllingExpressionCheck(this.context);
    for (const member of program.declarations) {
      for (const statement of StatementNodes.in(member.declaration)) {
        check.checkStatement(statement);
      }
      for (const part of DeclarationParts.of(member.declaration)) {
        for (const expr of ExpressionNodes.of(part)) check.checkTernary(expr);
      }
    }
    // Read off 1.2's syntax (#1991); reported in source order
    return check
      .errors()
      .sort((a, b) => a.line - b.line || a.column - b.column);
  }
}

export default ControllingExpressionAnalyzer;
