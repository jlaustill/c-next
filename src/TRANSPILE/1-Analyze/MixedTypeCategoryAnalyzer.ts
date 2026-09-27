/**
 * Mixed Type Category Analyzer
 *
 * Detects operators whose two operands have different essential type
 * categories at compile time: signed, unsigned, floating, and -- per MISRA
 * C:2012 Rule 10.4, for C-Next and header types alike (#1668, ruling 2) --
 * character, Boolean, and each named enum as a category of its own.
 *
 * MISRA C:2012 Rule 10.4: "Both operands of an operator in which the usual
 * arithmetic conversions are performed shall have the same essential type
 * category." Combining a signed and an unsigned value (e.g. `u32 + i32`) relies
 * on C's usual arithmetic conversions, whose result can be surprising (ADR-024).
 *
 * To combine a signed and an unsigned value, the developer reinterprets one
 * operand's bits to the other's category with bit indexing (ADR-007), e.g.
 * `a + b[0, 32]`, making the conversion explicit. To combine an integer and a
 * floating value, the developer casts the integer, e.g. `(f32)i * k` (#1668).
 *
 * UNSUFFIXED integer literals are exempt: such a literal has no fixed
 * essential category — it is contextually typed to the other operand
 * (ADR-052), so `a + 5` and `k * 3` are fine. A suffixed literal has its
 * suffix's category (#1668, R2): `a + 5i32` is signed against unsigned. A
 * float literal is NOT exempt: no integer operand can adopt it, so `i * 2.5`
 * is floating against unsigned. MISRA's one exception is kept: `+` and `+<-`
 * may combine a character with a signed or unsigned operand. The rule fires
 * only when BOTH operands resolve to a category, and the two differ.
 *
 * Compound assignments (`+<-`, `*<-`, ...) are the same operators, so the
 * target and the value are compared the same way (#1668). `y *<- 2.5` is
 * `y <- y * 2.5`; checking only the binary form rejected the second spelling
 * and accepted the first.
 *
 * Each operand is typed by the one operand typer (#1668), which binds a name
 * through Program's lexical frames -- so a same-named variable of a different
 * category in another function or a nested block never poisons the lookup
 * (Issue #1085 review) -- and types every shape of operand: fields, elements,
 * calls, casts, C and C++ operands. This analyzer applies Rule 10.4's policy
 * to the facts (`rule104Category`); the typer decides no policy.
 *
 * Note: shift operators (<< / >>) are intentionally NOT checked here — MISRA
 * Rule 10.4 only governs operators subject to the usual arithmetic conversions,
 * and a shift count is promoted independently. A signed shift count is a Rule
 * 10.1 concern handled elsewhere (Issue #1085 review).
 */

import { ParseTreeWalker, ParserRuleContext } from "antlr4ng";
import { CNextListener } from "../../PARSE/2-Parse/grammar/CNextListener";
import * as Parser from "../../PARSE/2-Parse/grammar/CNextParser";
import IMixedTypeCategoryError from "./types/IMixedTypeCategoryError";
import BinaryOperatorLevelListener from "./BinaryOperatorLevelListener";
import ParserUtils from "../../utils/ParserUtils";
import OperandTyper from "../../utils/OperandTyper";
import type IAnalysisContext from "./types/IAnalysisContext";
import type TBinaryOperatorLevel from "./types/TBinaryOperatorLevel";
import type IOperandType from "../../transpiler/types/IOperandType";

/**
 * A Rule 10.4 category: `signed`, `unsigned`, `floating`, `character`,
 * `boolean`, or `enum:<C name>` -- each named enum its own -- or null for an
 * operand with none (an unsuffixed literal, a bit, a struct, an unknown).
 */
type Category = string | null;

/** Assignments that are not arithmetic, so not Rule 10.4 operands */
const NOT_RULE_10_4_ASSIGNMENTS: ReadonlySet<string> = new Set([
  "<-",
  "<<<-",
  ">><-",
]);

/** The operators MISRA lets combine a character with an integer */
const CHARACTER_ARITHMETIC: ReadonlySet<string> = new Set(["+", "+<-"]);

class MixedCategoryListener extends CNextListener {
  constructor(
    private readonly analyzer: MixedTypeCategoryAnalyzer,
    private readonly context: IAnalysisContext,
  ) {
    super();
  }

  /**
   * An operand's Rule 10.4 category, or null when it has none. The policy
   * over the typer's facts, decided here and only here.
   */
  static rule104Category(t: IOperandType | null): Category {
    if (t === null) return null;
    // A subscript into a scalar is a bit index or range, not arithmetic
    // on the scalar's category (ADR-024)
    if (t.form.kind === "bitIndex" || t.form.kind === "bitRange") return null;
    // Which overload a call selects is C++'s decision, not ours (C03)
    if (t.form.kind === "foreign" && t.form.indeterminate) return null;
    if (t.category === "enum") return `enum:${t.enumTypeName ?? t.typeName}`;
    return t.category === "none" ? null : t.category;
  }

  /**
   * One category for an operand, from its value leaves: the category they
   * share, or null when they have none -- or disagree, which is reported at
   * the inner operator, once.
   */
  private operandCategory(ctx: ParserRuleContext): Category {
    let resolved: Category = null;
    for (const leaf of OperandTyper.valueLeaves(ctx, this.context)) {
      const category = MixedCategoryListener.rule104Category(leaf);
      if (category === null) continue;
      if (resolved === null) {
        resolved = category;
      } else if (resolved !== category) {
        return null;
      }
    }
    return resolved;
  }

  public checkLevel(
    operands: ParserRuleContext[],
    level: TBinaryOperatorLevel,
  ): void {
    const parent = operands[0]?.parent;
    const comparison = level === "equality" || level === "relational";
    for (let i = 0; i < operands.length - 1; i += 1) {
      const left = this.operandCategory(operands[i]);
      const right = this.operandCategory(operands[i + 1]);
      // ADR-017 owns a comparison with an enum operand (E0434, with its own
      // message); reporting it here too would be one defect, two codes
      if (
        comparison &&
        (left?.startsWith("enum:") || right?.startsWith("enum:"))
      ) {
        continue;
      }
      const operator = parent?.getChild(i * 2 + 1)?.getText() ?? "";
      if (MixedCategoryListener.differ(left, right, operator)) {
        const { line, column } = ParserUtils.getPosition(operands[i + 1]);
        this.analyzer.addError(line, column, left!, right!);
      }
    }
  }

  /** Whether two categories may not be combined by `operator` */
  private static differ(
    left: Category,
    right: Category,
    operator: string,
  ): boolean {
    if (left === null || right === null || left === right) return false;
    const integer = (c: string) => c === "signed" || c === "unsigned";
    const characterExempt =
      CHARACTER_ARITHMETIC.has(operator) &&
      ((left === "character" && integer(right)) ||
        (right === "character" && integer(left)));
    return !characterExempt;
  }

  override enterAssignmentStatement = (
    ctx: Parser.AssignmentStatementContext,
  ): void => {
    this.checkCompound(ctx.assignmentTarget(), ctx.assignmentOperator(), ctx);
  };

  override enterForAssignment = (ctx: Parser.ForAssignmentContext): void => {
    this.checkCompound(ctx.assignmentTarget(), ctx.assignmentOperator(), ctx);
  };

  override enterForUpdate = (ctx: Parser.ForUpdateContext): void => {
    this.checkCompound(ctx.assignmentTarget(), ctx.assignmentOperator(), ctx);
  };

  private checkCompound(
    target: Parser.AssignmentTargetContext,
    operator: Parser.AssignmentOperatorContext,
    statement: { expression(): Parser.ExpressionContext },
  ): void {
    const text = operator.getText();
    if (NOT_RULE_10_4_ASSIGNMENTS.has(text)) return;

    const value = statement.expression();
    const left = MixedCategoryListener.rule104Category(
      OperandTyper.typeOfTarget(target, this.context),
    );
    const right = this.operandCategory(value);
    if (MixedCategoryListener.differ(left, right, text)) {
      const { line, column } = ParserUtils.getPosition(value);
      this.analyzer.addError(line, column, left!, right!);
    }
  }
}

class MixedTypeCategoryAnalyzer {
  constructor(private readonly context: IAnalysisContext) {}

  private errors: IMixedTypeCategoryError[] = [];

  public analyze(tree: Parser.ProgramContext): IMixedTypeCategoryError[] {
    this.errors = [];
    const listener = new MixedCategoryListener(this, this.context);

    ParseTreeWalker.DEFAULT.walk(
      new BinaryOperatorLevelListener((operands, level) => {
        if (level === "shift") return;
        listener.checkLevel(operands, level);
      }),
      tree,
    );

    ParseTreeWalker.DEFAULT.walk(listener, tree);

    return this.errors;
  }

  /** How a category reads in a message */
  private static label(category: string): string {
    if (category.startsWith("enum:")) return `enum ${category.slice(5)}`;
    return category === "boolean" ? "Boolean" : category;
  }

  public addError(
    line: number,
    column: number,
    left: string,
    right: string,
  ): void {
    const integer = (c: string) => c === "signed" || c === "unsigned";
    const floating =
      (left === "floating" && integer(right)) ||
      (right === "floating" && integer(left));
    const signedness = integer(left) && integer(right);
    let pair = `${MixedTypeCategoryAnalyzer.label(left)} and ${MixedTypeCategoryAnalyzer.label(right)}`;
    if (floating) pair = "integer and floating";
    if (signedness) pair = "signed and unsigned";
    const rule =
      "MISRA C:2012 Rule 10.4: both operands must share an essential type category. ";
    let helpText = `${rule}Convert one operand explicitly, e.g. with a cast (ADR-024).`;
    if (floating) {
      helpText = `${rule}Convert the integer operand with an explicit cast, e.g. (f32)value (ADR-024).`;
    }
    if (signedness) {
      helpText = `${rule}Reinterpret one operand's bits to match the other with bit indexing, e.g. value[0, 32] (ADR-007/ADR-024).`;
    }
    this.errors.push({
      code: "E0810",
      line,
      column,
      message: `Binary operator combines operands of different essential type categories (${pair})`,
      helpText,
    });
  }
}

export default MixedTypeCategoryAnalyzer;
