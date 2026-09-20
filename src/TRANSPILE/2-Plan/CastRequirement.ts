import TYPE_WIDTH from "../../transpiler/constants/TYPE_WIDTH";
import INTEGER_TYPES from "../../transpiler/types/INTEGER_TYPES";
import FLOAT_TYPES from "../../transpiler/types/FLOAT_TYPES";

/**
 * Does a conversion need an explicit cast? (MISRA C:2012 Rule 10.3)
 *
 * 2.2 Plan decides; 2.3 Render formats. This is the decision half of what
 * `NarrowingCastHelper` used to hold whole: whether a cast appears at all is a
 * choice about WHAT C exists, while wrapping the expression in one -- picking
 * `(uint8_t)` over `static_cast<uint8_t>`, or a `!= 0U` comparison for a bool
 * target -- is a choice about how that reads. The second needs `CppModeHelper`
 * and `TYPE_MAP`, both render-side; this needs neither, which is the test that
 * it belongs here (#1450 box 4).
 *
 * It was worth separating for a reason beyond tidiness. `output/` carried
 * THREE answers to "is this conversion narrowing?": this one, and two dead
 * copies on `CastValidator` and `TypeResolver` that disagreed with it and with
 * each other on an unknown width -- deleted in `01d00cbe`. A decision with one
 * live implementation and two dead ones is one edit away from the wrong one
 * being revived, and the surviving answer is the one the corpus exercises.
 */
class CastRequirement {
  /**
   * Type widths including C's promoted `int`.
   *
   * `TYPE_WIDTH` is the shared table and holds C-Next types only; `int` is
   * what C's integer promotion produces, so a comparison against a promoted
   * operand needs it and nothing else does.
   */
  private static readonly WIDTH: Record<string, number> = {
    ...TYPE_WIDTH,
    int: 32,
  };

  /**
   * True when converting `sourceType` to `targetType` must be written as an
   * explicit cast.
   *
   * @param sourceType - the expression's type, or `"int"` once promoted
   * @param targetType - the target's C-Next type
   */
  static forConversion(sourceType: string, targetType: string): boolean {
    // Same type never needs a cast.
    if (sourceType === targetType) {
      return false;
    }

    // A bool target from a non-bool source always needs conversion.
    if (targetType === "bool" && sourceType !== "bool") {
      return true;
    }

    const sourceWidth = CastRequirement.WIDTH[sourceType];
    const targetWidth = CastRequirement.WIDTH[targetType];

    // An unknown width is not evidence of narrowing. Being conservative here
    // is deliberate and is the point the two deleted copies disagreed on: one
    // of them reported narrowing whenever the TARGET was unknown, which adds a
    // cast to a conversion nobody can size.
    if (sourceWidth === undefined || targetWidth === undefined) {
      return false;
    }

    // Narrowing: the source is wider than the target.
    return sourceWidth > targetWidth;
  }

  /**
   * True when the conversion must be CLAMPED, not merely cast.
   *
   * Issue #632: a float whose value falls outside the target integer's range
   * is undefined behavior in C, so float-to-integer needs explicit bounds
   * checking rather than a cast. Folded in beside `forConversion` because they
   * are two answers to one question -- "what does this conversion need?" --
   * and they were two modules: `CastValidator` held this one alone after
   * `01d00cbe` deleted the six dead predicates around it.
   */
  static requiresClamping(
    sourceType: string | null,
    targetType: string,
  ): boolean {
    if (!sourceType) return false;

    return (
      (INTEGER_TYPES as readonly string[]).includes(targetType) &&
      (FLOAT_TYPES as readonly string[]).includes(sourceType)
    );
  }
}

export default CastRequirement;
