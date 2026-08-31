import * as Parser from "../transpiler/logic/parser/grammar/CNextParser";
import type TOverflowBehavior from "../transpiler/types/TOverflowBehavior";

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
   *
   * Reads the CLAMP/WRAP tokens rather than comparing `getText()`, so a future
   * spelling change cannot silently turn every declaration into a clamp.
   */
  static fromModifier(
    modifier: Parser.OverflowModifierContext | null,
  ): TOverflowBehavior {
    if (modifier === null) {
      return "clamp";
    }
    return modifier.WRAP() === null ? "clamp" : "wrap";
  }
}

export default OverflowBehaviorUtils;
