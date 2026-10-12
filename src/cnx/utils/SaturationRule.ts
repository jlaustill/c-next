/**
 * ADR-024: where a float-to-integer cast saturates, decided once (#1268
 * review). `SaturatingCast` spells the rule in C and `ConstantEvaluator`
 * applies it to a folded value, so a check judges the value the emitted cast
 * gives. A float at or past the target's maximum, as the float's type holds
 * that maximum, is the maximum: `>=`, not `>` (#1760 review: `(float)UINT32_MAX`
 * rounds up to 2^32, and under `>` that value reached the raw cast, which is
 * undefined). A float below the minimum is the minimum.
 */
class SaturationRule {
  static readonly ABOVE: ">=" | ">" = ">=";
  static readonly BELOW: "<" | "<=" = "<";

  static saturatesAbove(value: number, max: number): boolean {
    return SaturationRule.ABOVE === ">=" ? value >= max : value > max;
  }

  static saturatesBelow(value: number, min: number): boolean {
    return SaturationRule.BELOW === "<" ? value < min : value <= min;
  }
}

export default SaturationRule;
