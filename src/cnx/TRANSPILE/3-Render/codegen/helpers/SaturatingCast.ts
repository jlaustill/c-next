/**
 * ADR-024 / Issue #632: the one shape of a saturating float-to-integer cast.
 *
 * C leaves an out-of-range float-to-int conversion undefined, and cnx's
 * default is to saturate, so the cast is a bounded ternary. Written once
 * because it is emitted in two places (#1668): inline, and as the body of the
 * single-evaluation helper a side-effecting operand is routed through. Two
 * copies of the ternary would be free to disagree about a bound.
 *
 * MISRA C:2012 Rule 10.3: the limit macros have type `int`, so each is cast
 * to the target type before use (the naive form assigns an `int` expression
 * to a narrower essential type).
 */
import TYPE_LIMITS from "../../../2-Plan/types/TYPE_LIMITS";
import CNX_TO_C_TYPE_MAP from "../../../../utils/constants/TypeMappings";
import invariant from "../../../../utils/invariant";
import SaturationRule from "../../../../utils/SaturationRule";

class SaturatingCast {
  /**
   * The bounded ternary saturating `operand` (a float expression, evaluated
   * up to three times) into `targetTypeName`, or null when the target has no
   * known limits (#644: the caller casts plainly).
   *
   * @param cast the mode's cast spelling, `(T)x` or `static_cast<T>(x)`
   */
  static expression(
    operand: string,
    sourceType: string,
    targetTypeName: string,
    targetCType: string,
    cast: (type: string, expr: string) => string,
  ): string | null {
    const maxValue = TYPE_LIMITS.TYPE_MAX[targetTypeName];
    const minValue = TYPE_LIMITS.TYPE_MIN[targetTypeName];
    if (!maxValue) return null;

    const floatSuffix = sourceType === "f32" ? "f" : "";
    const floatCType = SaturatingCast.floatCType(sourceType);
    // For unsigned types, minValue is "0", for signed a macro like INT8_MIN
    const minComparison =
      minValue === "0" ? `0.0${floatSuffix}` : `((${floatCType})${minValue})`;
    const maxComparison = `((${floatCType})${maxValue})`;

    const finalCast = cast(targetCType, `(${operand})`);
    const castMax = cast(targetCType, maxValue);
    const castMin = cast(targetCType, minValue);
    // Which side of each bound saturates is `SaturationRule`'s, shared with
    // the compile-time fold
    return `((${operand}) ${SaturationRule.ABOVE} ${maxComparison} ? ${castMax} : (${operand}) ${SaturationRule.BELOW} ${minComparison} ? ${castMin} : ${finalCast})`;
  }

  /**
   * The C type of a float source, from the one type map (#1760 second
   * review: this and the float-bits union each spelled it, with opposite
   * defaults for anything but `f32` and `f64`)
   */
  static floatCType(sourceType: string): string {
    const cType = CNX_TO_C_TYPE_MAP[sourceType];
    invariant(
      cType === "float" || cType === "double",
      `a saturating cast's source is a float ('${sourceType}')`,
    );
    return cType;
  }
}

export default SaturatingCast;
