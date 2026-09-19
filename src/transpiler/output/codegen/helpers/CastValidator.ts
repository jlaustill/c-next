/**
 * CastValidator - does this cast need clamping?
 *
 * Issue #632: a float-to-integer cast needs explicit bounds checking, because
 * converting a float whose value is outside the target's range is undefined
 * behavior in C. That is the whole of this module's job, and its one caller is
 * `CodeGenerator`.
 *
 * ## What was here, and why it is gone (#1450)
 *
 * Six further predicates -- `isIntegerType`, `isFloatType`, `isSignedType`,
 * `isUnsignedType`, `isNarrowingConversion`, `isSignConversion` -- plus
 * `getTypeWidth`. Every one of them was also declared on `TypeResolver`, under
 * the same name, in the same layer. Not one had a production caller: the only
 * reference to this module from outside it is `requiresClampingCast`, and the
 * rest were reachable only from each other and from this module's own tests,
 * which is why knip stayed green over them (#1418).
 *
 * They were not copies, either. The two `isNarrowingConversion`s disagreed on
 * an unknown width -- this one reported narrowing when the TARGET was unknown,
 * `TypeResolver`'s returned false whenever either width was -- and the two
 * `isSignConversion`s disagreed on `f32 -> i32`, which this one called a sign
 * change because a float is not in its signed set. Both halves of both
 * disagreements were dead, so nothing failed; what stood was two answers to one
 * question, with no way for the next caller to know they had picked one.
 *
 * ADR-024's narrowing and sign-change DECISIONS live in pass 2.1 (#1322).
 * Nothing in `output/` decides them, under any name -- which is what a Render
 * pass that "decides nothing" should look like.
 *
 * The type lists come from `types/` rather than being spelled again here. The
 * four `Set` literals this module declared held exactly the same eight integer
 * and two float names those modules hold.
 */

import INTEGER_TYPES from "../types/INTEGER_TYPES";
import FLOAT_TYPES from "../types/FLOAT_TYPES";

class CastValidator {
  /**
   * Check if a cast requires clamping (float-to-integer).
   * Float-to-integer casts need explicit bounds checking to avoid undefined behavior.
   *
   * @param sourceType The source type
   * @param targetType The target type
   * @returns true if clamping is required
   */
  static requiresClampingCast(
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

export default CastValidator;
