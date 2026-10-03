/**
 * Special assignment handlers (ADR-065).
 *
 * Handles special compound assignment operations:
 * - ATOMIC_RMW: atomic counter +<- 1
 * - OVERFLOW_CLAMP: clamp u8 saturated +<- 200
 */
import AssignmentKind from "../../../../../types/AssignmentKind";
import IAssignmentContext from "../../../../2-Plan/types/IAssignmentContext";
import AssignmentClassifier from "../../../../2-Plan/AssignmentClassifier";
import TAssignmentHandler from "./TAssignmentHandler";
import TTypeInfo from "../../../../../types/TTypeInfo";
import AdrProvenance from "../../../../../instrumentation/AdrProvenance";

/**
 * The target's type info. Both kinds are classified only when it resolved.
 */
function targetTypeInfo(ctx: IAssignmentContext): TTypeInfo {
  return AssignmentClassifier.targetTypeInfo(ctx)!;
}

/**
 * Handle atomic read-modify-write: atomic counter +<- 1
 *
 * Delegates to CodeGenerator's generateAtomicRMW which uses
 * LDREX/STREX on supported platforms or PRIMASK otherwise. Whether the inner
 * operation saturates is the classifier's decision, passed in.
 */
function handleAtomicRMW(ctx: IAssignmentContext): string {
  const typeInfo = targetTypeInfo(ctx);
  const target = ctx.renderTarget();

  return ctx.state
    .requireGenerator()
    .generateAtomicRMW(
      target,
      ctx.cOp,
      ctx.generatedValue,
      typeInfo,
      AssignmentClassifier.compoundClampOp(ctx, typeInfo),
    );
}

/**
 * Handle overflow-clamped compound assignment: clamp u8 saturated +<- 200
 *
 * Generates calls to cnx_clamp_add_u8, cnx_clamp_sub_u8, etc. Classified only
 * when `AssignmentClassifier.compoundClampOp` names a helper.
 */
function handleOverflowClamp(ctx: IAssignmentContext): string {
  const typeInfo = targetTypeInfo(ctx);
  const target = ctx.renderTarget();
  const helperOp = AssignmentClassifier.compoundClampOp(ctx, typeInfo);

  if (helperOp) {
    // #1241: ADR-044's rule firing on the COMPOUND form. The expression form
    // (`a <- a + b`) records in BinaryExprGenerator; this is the `a +<- b` path,
    // which reaches a different decision and would otherwise leave every
    // compound-only fixture without a derivable context. Recorded past the
    // helper decision, so only an actually-lowered clamp claims a cell.
    AdrProvenance.record("044", ctx.targetLine);
    ctx.state.markClampOpUsed(helperOp, typeInfo.baseType);
    return `${target} = cnx_clamp_${helperOp}_${typeInfo.baseType}(${target}, ${ctx.generatedValue});`;
  }

  return `${target} ${ctx.cOp} ${ctx.generatedValue};`;
}

/**
 * All special handlers for registration.
 */
const specialHandlers: ReadonlyArray<[AssignmentKind, TAssignmentHandler]> = [
  [AssignmentKind.ATOMIC_RMW, handleAtomicRMW],
  [AssignmentKind.OVERFLOW_CLAMP, handleOverflowClamp],
];

export default specialHandlers;
