/**
 * #1668: the one rule for the integer type of a composite -- `a + b * c` --
 * from its value leaves, shared by 2.1 (the conversion checks) and 2.2 (the
 * ADR-044 clamp helper's width).
 *
 * Both passes used to apply their own copy (`PrimitiveKindUtils.
 * widestIntegerOf` over operand-type strings each pass collected its own
 * way); this reads the leaves `OperandTyper.valueLeaves` collects, so the
 * two passes cannot count a different set.
 */
import type IOperandType from "../transpiler/types/IOperandType";

class CompositeType {
  /**
   * The widest integer among the counted leaves, signed if the first counted
   * leaf is, or null when the composite is not integer arithmetic:
   *
   * - a floating leaf vetoes it, and so does one whose category is unknown
   *   because a C++ overload set disagrees -- integer clamp helpers must not
   *   see either. A header's float macro (`#define SCALE 2.5f`) is not seen
   *   as floating at all, having no type C-Next can read, so the veto does
   *   not cover it (#1688);
   * - an integer leaf of unknown width (a C `int_fast16_t`) vetoes it too:
   *   the helper would be sized by a guess;
   * - leaves with no essential category (an unsuffixed literal, a struct),
   *   Boolean leaves and single bits are not counted;
   * - a bit range counts at its width; a suffixed literal at its suffix's.
   */
  static integerOf(leaves: ReadonlyArray<IOperandType | null>): string | null {
    if (CompositeType.anyFloating(leaves)) return null;
    let sign: "i" | "u" | null = null;
    let width = 0;
    for (const leaf of leaves) {
      if (leaf === null) continue;
      if (leaf.category !== "signed" && leaf.category !== "unsigned") continue;
      if (leaf.bitWidth === null) return null;
      sign ??= leaf.category === "signed" ? "i" : "u";
      width = Math.max(width, leaf.bitWidth);
    }
    return sign !== null && width > 0 ? `${sign}${width}` : null;
  }

  /**
   * The floating type of a composite -- or a conditional's two arms -- whose
   * leaves are floating: C's usual arithmetic conversions give f64 when any
   * floating leaf is f64, else the floating leaves' type. Null when no leaf
   * is floating. Leaves with no essential category (an unsuffixed literal)
   * are not counted, and the caller has settled that no leaf is an integer.
   *
   * #1760 review: a composite whose leaves had different type names --
   * `k * 2.0`, f32 x f64 literal -- was untyped, so a cast of it skipped
   * ADR-024's saturation and was emitted raw, which is undefined for an
   * out-of-range float.
   */
  static floatingOf(leaves: ReadonlyArray<IOperandType | null>): string | null {
    let floating: string | null = null;
    for (const leaf of leaves) {
      if (leaf === null || leaf.category !== "floating") continue;
      if (leaf.typeName === "f64") return "f64";
      floating ??= leaf.typeName;
    }
    return floating;
  }

  /** Whether a floating or indeterminate leaf makes this non-integer arithmetic */
  static anyFloating(leaves: ReadonlyArray<IOperandType | null>): boolean {
    return leaves.some(
      (leaf) =>
        leaf !== null &&
        (leaf.category === "floating" ||
          (leaf.form.kind === "foreign" && leaf.form.indeterminate)),
    );
  }
}

export default CompositeType;
