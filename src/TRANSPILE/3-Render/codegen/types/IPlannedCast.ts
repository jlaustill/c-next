/**
 * A cast expression, reduced to what rendering it needs (#1445 box 3).
 *
 * `targetType` and `operandCode` are already rendered, in that order; see
 * `CastExprGenerator` for why they are values rather than thunks.
 */
interface IPlannedCast {
  /** The target type as it will appear in C, e.g. `uint8_t`. */
  readonly targetType: string;

  /**
   * The target type's C-NEXT source text, e.g. `u8`.
   *
   * ADR-024's clamp rule and `TYPE_LIMITS` both key on this spelling, not on
   * the C one -- `TYPE_MAX` is indexed by `u8`, never by `uint8_t`.
   */
  readonly targetTypeName: string;

  /** The operand, already rendered. */
  readonly operandCode: string;

  /**
   * The operand's essential type, or null when it cannot be resolved.
   *
   * Only a float source can require clamping, so null simply means "not a
   * float" to `CastRequirement` and the cast renders plainly.
   */
  readonly operandType: string | null;
}

export default IPlannedCast;
