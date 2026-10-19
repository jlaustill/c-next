/**
 * ADR-068 (E0715, #1647): which assignment forms a `for` header clause cannot
 * hold. A clause is one C expression, and three forms lower to more than one
 * statement: a slice (one write per element), any write to an atomic (an
 * LDREX/STREX loop or a PRIMASK section, ADR-049 Q4/Q7), and a bit write on a
 * float (through a union). ADR-068 also rejects a string copy, which since
 * #2207 is one `cnx_string_copy` call; #2234 asks whether it still should.
 *
 * One decision, read off the operand typer: 2.1 reports it as E0715, and the
 * header renderer asserts it, so neither derives it again.
 */

import OperandTyper from "./OperandTyper";
import type IOperandType from "../types/IOperandType";
import type ITypingContext from "../types/ITypingContext";
import type IAssignmentSyntax from "../types/syntax/IAssignmentSyntax";

class ForHeaderAssignment {
  /** The form no header holds and why, or null for an assignment a header holds */
  static rejectedForm(
    site: IAssignmentSyntax,
    ctx: ITypingContext,
  ): string | null {
    const target = site.target;
    const steps = OperandTyper.chainOf(target, ctx).steps;
    const last = steps.at(-1);
    const isBitWrite =
      last?.subscript === "bit_single" || last?.subscript === "bit_range";
    if (isBitWrite && last.before?.category === "floating") {
      return "a float bit write is more than one statement";
    }
    const written = OperandTyper.typeOfTarget(target, ctx);
    const isPlain = site.operator === "<-";
    if (ForHeaderAssignment.isAtomic(written)) {
      return isPlain
        ? "an atomic store is more than one statement"
        : "an atomic read-modify-write is more than one statement";
    }
    if (!isPlain) return null;
    if (steps.some((step) => step.subscript === "array_slice")) {
      return "a slice write is more than one statement";
    }
    return OperandTyper.stringCopyCapacity(target, ctx) === null
      ? null
      : "a string copy, which ADR-068 keeps out of a header (#2234)";
  }

  /** Declared `atomic`, by the declaration the target binds to */
  static isAtomic(t: IOperandType | null): boolean {
    const binding = t?.binding;
    if (binding?.kind === "local") return binding.declaration.isAtomic;
    if (binding?.kind === "variable") return binding.symbol.isAtomic;
    return false;
  }
}

export default ForHeaderAssignment;
