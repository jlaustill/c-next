/**
 * Cast Expression Generator
 *
 * Renders `(type)expr`, including ADR-024's float-to-integer clamp (#632):
 * C leaves an out-of-range float-to-int conversion undefined, and cnx's
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
import invariant from "../../../../../utils/invariant";
import CppModeHelper from "../../../../2-Plan/CppModeHelper";
import SaturatingCast from "../../helpers/SaturatingCast";
import ReservedCnxName from "../../../../../utils/ReservedCnxName";
import type IPlannedCast from "../../../../2-Plan/types/IPlannedCast";
import type TranspileState from "../../../../TranspileState";

/**
 * Render a cast expression, as the plan decided its form.
 *
 * Issue #267/#644: C++ mode emits `static_cast` for MISRA compliance, which
 * `CppModeHelper.cast` decides. ADR-024 / Issue #632: a float-to-integer cast
 * saturates; #1668: when its operand has a side effect it calls the
 * single-evaluation helper, because the inline ternary reads the operand up
 * to three times.
 */
function generateCast(plan: IPlannedCast, state: TranspileState): string {
  const cast = (type: string, expr: string): string =>
    CppModeHelper.cast(type, expr, state);
  // `plan.targetType` needs no record of its own (#1927): it is the output of
  // `generateType`, which recorded it. That also covers the helper's return
  // type and the type whose limit macros the saturating form compares against.
  if (plan.clampForm === null) return cast(plan.targetType, plan.operandCode);

  // The plan saturates only a float source into a cnx integer target
  // (`CastRequirement.requiresClamping`), and every one of those has limit
  // macros. Render re-checked the limits and fell back to a raw cast, a path
  // the plan's decision left unreachable (#1668 review).
  const sourceType = plan.operandType;
  invariant(sourceType !== null, "the plan saturates a typed float source");

  // 2.2 required <limits.h>, and the helper, when it planned this cast (#1991)
  if (plan.clampForm === "helper") {
    return `${ReservedCnxName.castHelper(sourceType, plan.targetTypeName)}(${plan.operandCode})`;
  }
  const expression = SaturatingCast.expression(
    plan.operandCode,
    sourceType,
    plan.targetTypeName,
    plan.targetType,
    cast,
  );
  invariant(expression !== null, "every cnx integer target has limits");
  return expression;
}

export default generateCast;
