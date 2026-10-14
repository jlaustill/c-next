import type TOverflowBehavior from "../types/TOverflowBehavior";

/**
 * ADR-044 overflow behavior, decoded from a declaration's `clamp`/`wrap`
 * modifier.
 *
 * Issue #1303: this decision used to be spelled inline in
 * `TypeRegistrationEngine`, the only site that read the modifier at all -- and
 * that site lives in the OUTPUT layer, so it ran solely for the file being
 * generated. A `u8` reached codegen from an included `.cnx` with its declared
 * behavior already gone, and the same statement clamped locally while it
 * wrapped across a file boundary.
 *
 * Keeping the decode here means the symbols layer can author the fact onto the
 * symbol (where it travels across files) without restating the rule that
 * "absent means clamp" -- restating it is what let the two paths diverge.
 */
class OverflowBehaviorUtils {
  /**
   * `clamp` is ADR-044's default: absent modifier means clamp, never wrap.
   * The modifier arrives as 1.2 lowered it (`SyntaxLowering.overflow`, #1991).
   */
  static fromModifier(modifier: TOverflowBehavior | null): TOverflowBehavior {
    return modifier ?? "clamp";
  }
}

export default OverflowBehaviorUtils;
