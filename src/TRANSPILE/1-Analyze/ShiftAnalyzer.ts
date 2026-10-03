/**
 * Shift Analyzer: E0805 (signed operand) and E0873 (amount out of range).
 *
 * MISRA C:2012 Rule 10.1: Operands shall not be of an inappropriate essential type
 * - Left-shifting negative signed values is undefined behavior in C
 * - Right-shifting negative signed values is implementation-defined in C
 *
 * C-Next rejects all shift operations on signed types (i8, i16, i32, i64) at
 * compile time to ensure defined, portable behavior.
 *
 * MISRA C:2012 Rule 12.2: the right operand of a shift shall lie in the range
 * zero to one less than the essential width of the left operand. #1322 moved
 * that rule here from `output/`. It reads the LEADING operand's type, as
 * codegen did (`(a + 1) << 9` is a composite and stays untyped), and
 * evaluates the amount when it is a literal or a named const. The compound
 * forms (`a <<<- 9`) are checked the same way.
 *
 * The signed rule asks whether ANY value leaf of the shifted operand is
 * signed, or is a negated literal (`-5`, signed in C, though an unsuffixed
 * literal has no category of its own under ADR-052). The width rule asks the
 * leading operand's type.
 *
 * Every operand is typed by the one operand typer, and every amount is
 * evaluated by it, binding names through Program's lexical frames (#1668):
 * a field, element, cast, call or C header operand is typed like a variable,
 * and a const local shadows as it does everywhere else. Every assignment
 * site is checked, `for` headers included (#1726).
 */

import { ParseTreeWalker, ParserRuleContext } from "antlr4ng";
import * as Parser from "../../PARSE/2-Parse/grammar/CNextParser";
import IShiftError from "./types/IShiftError";
import ParserUtils from "../../utils/ParserUtils";
import OperandTyper from "../../utils/OperandTyper";
import TypeCheckUtils from "../../utils/TypeCheckUtils";
import BinaryOperatorLevelListener from "./BinaryOperatorLevelListener";
import AssignmentSiteListener from "./AssignmentSiteListener";
import type IAnalysisContext from "./types/IAnalysisContext";
import type TAssignmentSite from "./types/TAssignmentSite";
import type IOperandType from "../../types/IOperandType";

class ShiftCheck {
  constructor(
    private readonly analyzer: ShiftAnalyzer,
    private readonly context: IAnalysisContext,
  ) {}

  /** Each `<<` / `>>` of one shift level, between adjacent operands */
  public checkLevel(operands: ParserRuleContext[]): void {
    const parent = operands[0]?.parent;
    if (!parent) return;
    for (let i = 0; i < operands.length - 1; i += 1) {
      const operator = parent.getChild(i * 2 + 1)?.getText() ?? "";
      if (operator !== "<<" && operator !== ">>") continue;

      const left = operands[i];
      if (this.isSigned(left)) {
        const { line, column } = ParserUtils.getPosition(left);
        this.analyzer.addError(line, column, operator);
        continue;
      }

      // Rule 12.2: the amount against the width of the value shifted. For a
      // composite that is ADR-044's composite type, the one codegen emits it
      // by (#1668 review: this read the first leaf's, so `a + b << 9` with a
      // u8 `a` and a u32 `b` was E0873 against 8 bits, while the C shifts
      // `cnx_clamp_add_u32(a, b)`)
      this.checkAmount(
        ShiftCheck.shiftedType(left, this.context),
        operands[i + 1],
        parent,
      );
    }
  }

  /**
   * `<<<-` and `>><-`: a signed target is E0805 (#1008), and the amount is
   * checked against the target's width, which codegen never did -- `a <<<- 9`
   * on a u8 emitted `a = (uint8_t)(a << 9U)` at exit 0.
   */
  public checkAssignment(site: TAssignmentSite): void {
    const operator = site.assignmentOperator();
    const left = operator.LSHIFT_ASSIGN() !== null;
    if (!left && operator.RSHIFT_ASSIGN() === null) return;

    const target = site.assignmentTarget();
    const targetType = OperandTyper.typeOfTarget(target, this.context);
    if (targetType?.category === "signed") {
      const { line, column } = ParserUtils.getPosition(target);
      this.analyzer.addError(line, column, left ? "<<<-" : ">><-");
      return;
    }
    this.checkAmount(targetType, site.expression(), site);
  }

  /**
   * The type of the value a shift shifts: a composite's integer type, as the
   * typer settled it, or the operand's own type.
   */
  private static shiftedType(
    left: ParserRuleContext,
    context: IAnalysisContext,
  ): IOperandType | null {
    const t = OperandTyper.typeOf(left, context);
    if (t?.form.kind !== "composite") return t;
    if (t.typeName === null || t.bitWidth === null) return null;
    return {
      ...t,
      category: TypeCheckUtils.isSigned(t.typeName) ? "signed" : "unsigned",
    };
  }

  /** Any value leaf signed, or a negated literal */
  private isSigned(operand: ParserRuleContext): boolean {
    return OperandTyper.valueLeaves(operand, this.context).some(
      (leaf) =>
        leaf !== null &&
        (leaf.category === "signed" ||
          (leaf.form.kind === "literal" && leaf.form.negated)),
    );
  }

  /**
   * E0873: a compile-time shift amount that is negative or not below the
   * width of the shifted operand's type. Silent when either side is unknown
   * -- a runtime amount, or an operand with no integer width. A bit of a
   * scalar is not an integer operand of its own (ADR-024).
   */
  private checkAmount(
    shifted: IOperandType | null,
    amountExpr: ParserRuleContext,
    at: ParserRuleContext,
  ): void {
    if (shifted === null) return;
    if (shifted.form.kind === "bitIndex" || shifted.form.kind === "bitRange") {
      return;
    }
    const integer =
      shifted.category === "signed" || shifted.category === "unsigned";
    const width = shifted.bitWidth;
    if (!integer || width === null || shifted.dimensions.length > 0) return;
    const leftType = shifted.typeName ?? shifted.category;
    const amount = OperandTyper.constantOf(amountExpr, this.context);
    if (amount === null) return;
    const { line, column } = ParserUtils.getPosition(amountExpr);
    if (amount < 0) {
      this.analyzer.addAmountError(
        line,
        column,
        `Negative shift amount (${amount}) is undefined behavior (type: ${leftType}, expression: ${at.getText()})`,
        "Shift amounts must be non-negative (MISRA C:2012 Rule 12.2).",
      );
      return;
    }
    if (amount >= width) {
      this.analyzer.addAmountError(
        line,
        column,
        `Shift amount (${amount}) exceeds type width (${width} bits) for type '${leftType}' (expression: ${at.getText()})`,
        `Shift amount must be < ${width} for ${width}-bit types; shifting by the width or more is undefined behavior (MISRA C:2012 Rule 12.2).`,
      );
    }
  }
}

/**
 * Analyzer that detects shift operations on signed integer types, and shift
 * amounts outside the shifted operand's width.
 */
class ShiftAnalyzer {
  private errors: IShiftError[] = [];

  /** #1456: handed in rather than read off shared state. */
  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  constructor(private readonly context: IAnalysisContext) {}

  /**
   * Analyze the parse tree for shift operations
   */
  public analyze(tree: Parser.ProgramContext): IShiftError[] {
    this.errors = [];
    const check = new ShiftCheck(this, this.context);

    ParseTreeWalker.DEFAULT.walk(
      new BinaryOperatorLevelListener((operands, level) => {
        if (level === "shift") check.checkLevel(operands);
      }),
      tree,
    );
    ParseTreeWalker.DEFAULT.walk(
      new AssignmentSiteListener((site) => check.checkAssignment(site)),
      tree,
    );

    // Two walks; report in source order, as the one walk they replace did
    return this.errors.sort((a, b) => a.line - b.line || a.column - b.column);
  }

  /**
   * Add a signed shift error
   */
  public addError(line: number, column: number, operator: string): void {
    this.errors.push({
      code: "E0805",
      line,
      column,
      message: `Shift operator '${operator}' not allowed on signed integer types`,
      helpText:
        "Shift operations on signed integers have undefined (<<) or implementation-defined (>>) behavior. Use unsigned types (u8, u16, u32, u64) for bit manipulation.",
    });
  }

  /**
   * Add a shift amount error (E0873)
   */
  public addAmountError(
    line: number,
    column: number,
    message: string,
    helpText: string,
  ): void {
    this.errors.push({ code: "E0873", line, column, message, helpText });
  }
}

export default ShiftAnalyzer;
