/**
 * AutoConstRule - the single decision for ADR-013 / #268 auto-const.
 *
 * "This parameter is never modified, so qualify it `const`" was decided in
 * three places with three different rules (#1545): the body's general path,
 * the body's string path, and the header path. The three disagreed, and
 * ADR-013 requires them not to:
 *
 *   "The auto-const information is synchronized to symbol metadata so header
 *    files (.h) match implementation files (.c)"
 *
 * They also agreed only by coincidence where they did agree. The body's paths
 * carried no float/enum/ISR exclusions at all; that is invisible today because
 * ParameterSignatureBuilder routes pass-by-value parameters to a branch which
 * reads `isConst` and ignores `isAutoConst`. An unrelated predicate hiding a
 * disagreement is what CLAUDE.md calls a latent divergence rather than a
 * unified path, so the exclusions live here whether or not a caller can
 * currently observe them.
 *
 * Callers supply IAutoConstFacts from whichever representation they hold. The
 * decision is here; only the lookups are theirs.
 */

import IAutoConstFacts from "./types/IAutoConstFacts";
import TypeCheckUtils from "./TypeCheckUtils";

class AutoConstRule {
  /**
   * Whether ADR-013 auto-const applies to a parameter.
   *
   * @param facts - the parameter's facts, in the caller's own vocabulary
   * @returns true if the generated parameter should gain an inferred `const`
   */
  static applies(facts: IAutoConstFacts): boolean {
    // Already const in the source. ADR-013: "already const, redundant".
    if (facts.isExplicitlyConst) {
      return false;
    }

    // #895: the function is assigned to a C callback typedef, which dictates
    // the parameter shape. Narrowing `char *` to `const char *` makes the
    // function stop matching the typedef it is handed to -- a contract C-Next
    // does not own. A developer who wants const on a callback parameter writes
    // it explicitly -- and that is honored by ParameterSignatureBuilder, whose
    // _getConstPrefix ORs `isConst` in independently of `isAutoConst`, NOT by
    // the guard above. Every guard here returns false, so their order carries
    // no meaning and swapping any two changes nothing.
    if (facts.isCallbackCompatible) {
      return false;
    }

    // The body assigns through it, so it is not const.
    if (facts.isModified) {
      return false;
    }

    // #986: arrays are pass-by-reference and mutable by default -- auto-const
    // would break C APIs expecting mutable pointers. NOTE: ADR-013's "What
    // Gets Auto-Const" still lists arrays as receiving it, which contradicts
    // this and every implementation; tracked as #1602, whose resolution is a
    // maintainer decision. Current behavior is preserved here deliberately
    // rather than resolved in passing.
    if (facts.isArray) {
      return false;
    }

    // ADR-013 "NOT applied to": float and ISR are passed by value, not as a
    // pointer, so there is no pointed-to type to qualify. The float half asks
    // TypeCheckUtils rather than spelling {f32, f64} a ninth time -- a
    // hand-written copy is what lets a future by-value type reach some of the
    // sites that must exclude it and not others.
    if (TypeCheckUtils.isFloat(facts.baseType) || facts.baseType === "ISR") {
      return false;
    }

    // ADR-013 "NOT applied to": enums are passed by value.
    if (facts.isKnownEnum) {
      return false;
    }

    // #995: an opaque handle is an incomplete type reached only through a
    // pointer, and the C APIs that produce one expect it mutable. This was the
    // one ADR-013 exclusion still decided outside this file -- in
    // ParameterSignatureBuilder._getConstPrefix, which zeroes isAutoConst for
    // an opaque handle. Both callers already compute the fact beside their
    // applies(...) call, so asking here makes the rule total; the builder's
    // guard stays as the backstop for inputs this rule never saw.
    if (facts.isOpaqueHandle) {
      return false;
    }

    return true;
  }
}

export default AutoConstRule;
