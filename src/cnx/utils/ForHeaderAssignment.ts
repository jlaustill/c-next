/**
 * ADR-068 (E0715, #1647): which assignment forms a `for` header clause cannot
 * hold. A clause is one C expression, and these forms lower to more than one
 * statement: a string copy (`strncpy` and a terminator), a slice (one write per
 * element), any write to an atomic (an LDREX/STREX loop or a PRIMASK section,
 * ADR-049 Q4/Q7), and a bit write on a float (through a union).
 *
 * One decision, read off the operand typer: 2.1 reports it as E0715, and the
 * header renderer asserts it, so neither derives it again. Which writes are
 * atomic is `AtomicOwner`'s answer, the one 2.2 plans the write's form from:
 * a bit or bitmap-field write to an atomic is a read-modify-write too (#2200),
 * and its written type, a bit, carries no `atomic` (#2155 review).
 */

import AtomicOwner from "./AtomicOwner";
import BitmapFieldStep from "./BitmapFieldStep";
import OperandTyper from "./OperandTyper";
import type ITypingContext from "../types/ITypingContext";
import type IAssignmentSyntax from "../types/syntax/IAssignmentSyntax";

class ForHeaderAssignment {
  /** What the assignment lowers to that no header holds, or null if it is one expression */
  static multiStatementForm(
    site: IAssignmentSyntax,
    ctx: ITypingContext,
  ): string | null {
    const target = site.target;
    const steps = OperandTyper.chainOf(target, ctx).steps;
    const last = steps.at(-1);
    const isBitWrite =
      last?.subscript === "bit_single" || last?.subscript === "bit_range";
    if (isBitWrite && last.before?.category === "floating") {
      return "a float bit write";
    }
    const field = BitmapFieldStep.fieldOf(last, ctx.symbols.bitmapFields);
    if (AtomicOwner.ofWrite(site, ctx, field) !== null) {
      return "an atomic read-modify-write";
    }
    const written = OperandTyper.typeOfTarget(target, ctx);
    if (site.operator !== "<-") return null;
    if (AtomicOwner.isDeclaredAtomic(written)) return "an atomic store";
    if (steps.some((step) => step.subscript === "array_slice")) {
      return "a slice write";
    }
    return OperandTyper.isScalarString(written) ? "a string copy" : null;
  }
}

export default ForHeaderAssignment;
