/**
 * ADR-068 (E0715, #1647): which assignment forms a `for` header clause cannot
 * hold. A clause is one C expression, and these forms lower to more than one
 * statement: a string copy (`strncpy` and a terminator), a slice (one write per
 * element), any write to an atomic (an LDREX/STREX loop or a PRIMASK section,
 * ADR-049 Q4/Q7), and a bit write on a float (through a union).
 *
 * One decision, read off the operand typer: 2.1 reports it as E0715, and the
 * header renderer asserts it, so neither derives it again.
 */

import OperandTyper from "./OperandTyper";
import type IOperandType from "../types/IOperandType";
import type ITypingContext from "../types/ITypingContext";
import type TAssignmentSite from "../types/TAssignmentSite";

class ForHeaderAssignment {
  /** What the assignment lowers to that no header holds, or null if it is one expression */
  static multiStatementForm(
    site: TAssignmentSite,
    ctx: ITypingContext,
  ): string | null {
    const target = site.assignmentTarget();
    const steps = OperandTyper.chainOf(target, ctx).steps;
    const last = steps.at(-1);
    const isBitWrite =
      last?.subscript === "bit_single" || last?.subscript === "bit_range";
    if (isBitWrite && last.before?.category === "floating") {
      return "a float bit write";
    }
    const written = OperandTyper.typeOfTarget(target, ctx);
    const isPlain = site.assignmentOperator().ASSIGN() !== null;
    if (ForHeaderAssignment.isAtomic(written)) {
      return isPlain ? "an atomic store" : "an atomic read-modify-write";
    }
    if (!isPlain) return null;
    if (steps.some((step) => step.subscript === "array_slice")) {
      return "a slice write";
    }
    return OperandTyper.isScalarString(written) ? "a string copy" : null;
  }

  /** Declared `atomic`, by the declaration the target binds to */
  private static isAtomic(t: IOperandType | null): boolean {
    const binding = t?.binding;
    if (binding?.kind === "local") return binding.declaration.isAtomic;
    if (binding?.kind === "variable") return binding.symbol.isAtomic;
    return false;
  }
}

export default ForHeaderAssignment;
