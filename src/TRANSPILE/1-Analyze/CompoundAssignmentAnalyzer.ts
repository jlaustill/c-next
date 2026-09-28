/**
 * E0857: a compound operator needs a whole storage location.
 *
 * `+<-` and friends are read-modify-write. C-Next implements them where the
 * target names one location it can read and write back, and rejects them on a
 * bit index, a bit range, a slice or a string.
 *
 * #1322. This was the audit's largest duplicate group: **six** throws with four
 * message variants, across `AccessPatternHandlers`, `BitAccessHandlers`,
 * `AssignmentHandlerUtils`, `BitmapHandlers`, `StringHandlers` and
 * `ArrayHandlers` -- and `validateNotCompound` was defined twice, verbatim, in
 * two of them. Six sites deciding one thing, which is the shape CLAUDE.md calls
 * the project's worst anti-pattern.
 *
 * ## Why it is a 2.1 rule and not a syntactic one
 *
 * `arr[0] +<- 2` is accepted; `flags[0] +<- 1` is rejected. Same production.
 * What differs is whether the base was declared as an array -- on a scalar, a
 * subscript is a BIT index (ADR-007), and a bit is not a location the compound
 * lowering can write back to.
 *
 * That is why this family could not move before `IDeclaredVar.dimensions`
 * existed: the only place that knew `flags` was scalar and `arr` was not, was
 * codegen's type registry, which is populated after the analyzers run.
 *
 * A two-expression subscript needs no such lookup -- a range or a slice is not
 * one location whatever the base -- so the array-ness question is asked only
 * where it decides something.
 */

import { ParseTreeWalker } from "antlr4ng";

import * as Parser from "../../PARSE/2-Parse/grammar/CNextParser";
import ParserUtils from "../../utils/ParserUtils";
import OperandTyper from "../../utils/OperandTyper";
import AssignmentSiteListener from "./AssignmentSiteListener";
import ICompoundAssignmentError from "./types/ICompoundAssignmentError";
import type IOperandType from "../../transpiler/types/IOperandType";
import type TAssignmentSite from "./types/TAssignmentSite";
import type IAnalysisContext from "./types/IAnalysisContext";

/** What made a target unusable, in words the message can name. */
type TRejection = "bit index" | "bit range or slice" | "string";

class CompoundAssignmentCheck {
  private readonly found: ICompoundAssignmentError[] = [];

  public constructor(private readonly context: IAnalysisContext) {}

  public errors(): ICompoundAssignmentError[] {
    return this.found;
  }

  /** A compound assignment, in a statement or a `for` header (#1726) */
  public checkSite(site: TAssignmentSite): void {
    // `ASSIGN` is the plain `<-`; every other operator in the rule is compound.
    // Asking what it is NOT keeps this from listing the operators, which is the
    // enumeration that let E0853 miss `switch`.
    if (site.assignmentOperator().ASSIGN()) return;

    const reason = this.rejectionFor(site.assignmentTarget());
    if (reason === null) return;

    const { line, column } = ParserUtils.getPosition(site);
    this.found.push({
      code: "E0857",
      line,
      column,
      message: `Compound assignment operators are not supported on a ${reason}`,
      helpText:
        "A compound operator reads, modifies and writes back one storage location. Write the read and the write out separately.",
    });
  }

  /**
   * Why this target cannot take a compound operator, or null.
   *
   * Each subscript is what the one operand typer classified it as, against
   * the shape of what it indexes (#1668). That is what makes
   * `bytes.data[0] +<- 5` legal while `flags[0] +<- 1` is not: the first
   * indexes a struct field declared an array, the second a scalar, which is a
   * bit index (ADR-007). A shape the typer cannot establish is array access,
   * and never rejects: a name this pass cannot resolve is another
   * diagnostic's to report, not this one's to guess at.
   */
  private rejectionFor(
    target: Parser.AssignmentTargetContext,
  ): TRejection | null {
    // A range or a slice is never one storage location, whatever it
    // indexes, so this needs no resolved shape.
    if (target.postfixTargetOp().some((op) => op.expression().length >= 2)) {
      return "bit range or slice";
    }
    const typing = OperandTyper.chainOf(target, this.context);
    if (typing.steps.some((step) => step.subscript === "bit_single")) {
      return "bit index";
    }
    // The chain may END on a string -- `config.name +<- " suffix"` where
    // `name` is a `string<32>` field. A string is a buffer copied by
    // `strncpy`, not a value `+` can be applied to, wherever it is reached
    // from.
    const last = OperandTyper.typeOfTarget(target, this.context);
    return CompoundAssignmentAnalyzer.isString(last) ? "string" : null;
  }
}

class CompoundAssignmentAnalyzer {
  /** #1456: handed in rather than read off shared state. */
  constructor(private readonly context: IAnalysisContext) {}

  /** A bounded string value -- not an element of one, which is a char */
  public static isString(t: IOperandType | null): boolean {
    return t !== null && t.dimensions.length === 0 && OperandTyper.isString(t);
  }

  public analyze(tree: Parser.ProgramContext): ICompoundAssignmentError[] {
    const check = new CompoundAssignmentCheck(this.context);
    ParseTreeWalker.DEFAULT.walk(
      new AssignmentSiteListener((site) => check.checkSite(site)),
      tree,
    );
    return check.errors();
  }
}

export default CompoundAssignmentAnalyzer;
