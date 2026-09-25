/**
 * Cast Expression Generator
 *
 * Renders `(type)expr`, including ADR-024's float-to-integer clamp (#632):
 * C leaves an out-of-range float-to-int conversion undefined, and C-Next's
 * default is to saturate, so the cast expands to a bounded ternary.
 *
 * #1445 box 3: takes the target type and the operand ALREADY RENDERED, not
 * the node. The node was read for exactly four things -- the target type's
 * generated form, its source text, the operand's generated form, and the
 * operand's type -- and inspected for none of them.
 *
 * The two rendered strings are values rather than thunks ON PURPOSE. Both are
 * produced unconditionally by the caller, in that order, and both have side
 * effects: `generateType` can register an include for the target type, and
 * rendering the operand can allocate a `cnx_tmp<N>`. Passing thunks would move
 * the ORDER of those two effects into this module, where a later edit could
 * reverse it and rename every temp in the emitted C -- a diff no test
 * asserts directly. Rendering stays with the walker; this decides shape only.
 */
import TYPE_LIMITS from "../../types/TYPE_LIMITS";
import CppModeHelper from "../../helpers/CppModeHelper";
import CastRequirement from "../../../../2-Plan/CastRequirement";
import type IPlannedCast from "../../types/IPlannedCast";
import type RenderState from "../../../RenderState";

/**
 * ADR-024 / Issue #632: a float-to-integer cast clamps rather than invoking
 * undefined behavior.
 *
 * MISRA C:2012 Rule 10.3: the limit macros have type `int`, so each is cast to
 * the target type before use (the naive form assigns an `int` expression to a
 * narrower essential type).
 */
function renderClampedCast(
  plan: IPlannedCast,
  sourceType: string,
  state: RenderState,
): string {
  const maxValue = TYPE_LIMITS.TYPE_MAX[plan.targetTypeName];
  const minValue = TYPE_LIMITS.TYPE_MIN[plan.targetTypeName];

  if (!maxValue) {
    // Unknown type, fall back to raw cast - Issue #644
    return CppModeHelper.cast(plan.targetType, plan.operandCode, state);
  }

  // Mark that we need limits.h for the type limit macros
  state.requireInclude("limits");

  // Use appropriate float suffix and type for comparisons
  const floatSuffix = sourceType === "f32" ? "f" : "";
  const floatCastType = sourceType === "f32" ? "float" : "double";

  // For unsigned types, minValue is "0", for signed it's a macro like INT8_MIN
  const minComparison =
    minValue === "0" ? `0.0${floatSuffix}` : `((${floatCastType})${minValue})`;
  const maxComparison = `((${floatCastType})${maxValue})`;

  const expr = plan.operandCode;
  const finalCast = CppModeHelper.cast(plan.targetType, `(${expr})`, state);
  const castMax = CppModeHelper.cast(plan.targetType, maxValue, state);
  const castMin = CppModeHelper.cast(plan.targetType, minValue, state);
  return `((${expr}) > ${maxComparison} ? ${castMax} : (${expr}) < ${minComparison} ? ${castMin} : ${finalCast})`;
}

/**
 * Render a cast expression.
 *
 * Issue #267/#644: C++ mode emits `static_cast` for MISRA compliance, which
 * `CppModeHelper.cast` decides.
 */
function generateCast(plan: IPlannedCast, state: RenderState): string {
  if (CastRequirement.requiresClamping(plan.operandType, plan.targetTypeName)) {
    return renderClampedCast(plan, plan.operandType!, state);
  }

  return CppModeHelper.cast(plan.targetType, plan.operandCode, state);
}

export default generateCast;
