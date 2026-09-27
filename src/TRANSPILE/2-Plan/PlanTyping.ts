/**
 * #1668: 2.2's readings of the one operand typer's facts -- the policy rows
 * for the plan's typing sites, which the design (§5) keeps in one 2-Plan
 * module because several sites share them. The typer reports facts; each row
 * here decides what one site does with them, and nowhere else does.
 */
import type IOperandType from "../../transpiler/types/IOperandType";
import type TOverflowBehavior from "../../transpiler/types/TOverflowBehavior";

class PlanTyping {
  /**
   * The type a cast converts FROM, for ADR-024's saturation decision: the
   * typer's type, so a call, a callback, a struct field, an element and a C
   * or C++ header's value are typed like a variable, and a float among them
   * saturates. A Boolean -- `!k`, a comparison -- is the typer's `bool`,
   * whatever its operand was: `(u32)!k` converts 0 or 1, nothing to saturate.
   */
  static castSourceType(t: IOperandType | null): string | null {
    return t?.typeName ?? null;
  }

  /**
   * The type 2.2 reads an expression AS, for the sites that take one type for
   * the whole of it: the MISRA 10.3 cast on an initializer, a simple
   * assignment, a slice source, a call argument, `~`'s width. A composite or a
   * ternary has no one type there -- its operands are typed one by one, by
   * CompositeType -- so it is null, as it always was; anything else is the
   * typer's type: `int` for an unsuffixed literal, the suffix's for a
   * suffixed one, `bool` for a Boolean.
   */
  static directTypeName(t: IOperandType | null): string | null {
    if (t === null) return null;
    if (t.form.kind === "composite" || t.form.kind === "ternary") return null;
    return t.typeName;
  }

  /**
   * ADR-044: whether a composite's arithmetic saturates or wraps, from its
   * value leaves. Safety wins a mix: it wraps only when every counted integer
   * leaf was declared `wrap`, so one saturating operand makes the result
   * saturate (#231's bounds guards). Null when no leaf is counted, and the
   * expression is left alone.
   *
   * A leaf counts only when it is a whole named variable -- an element, a
   * field or a call result has no declared behavior of its own (#1411, #1703
   * stay out). A parameter (#1681) and a `for` variable (#1667) count by
   * their declarations like any local: a parameter has no modifier in the
   * grammar, so it clamps.
   */
  static overflowOf(
    leaves: ReadonlyArray<IOperandType | null>,
  ): TOverflowBehavior | null {
    let counted = false;
    for (const leaf of leaves) {
      const behavior = PlanTyping.countedBehavior(leaf);
      if (behavior === undefined) continue;
      counted = true;
      if (behavior === "clamp") return "clamp";
    }
    return counted ? "wrap" : null;
  }

  /** A leaf's behavior when it counts, null for a counted leaf with none */
  private static countedBehavior(
    leaf: IOperandType | null,
  ): TOverflowBehavior | null | undefined {
    if (!leaf?.binding) return undefined;
    if (leaf.category !== "signed" && leaf.category !== "unsigned") {
      return undefined;
    }
    return leaf.overflow;
  }
}

export default PlanTyping;
