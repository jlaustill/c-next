/**
 * Access pattern assignment handlers (ADR-065).
 *
 * Handles assignments with global/this prefix and member chains:
 * - GLOBAL_ARRAY: global.obj.field[i] <- value (member chain)
 * - GLOBAL_MEMBER: global.Counter.value <- 5
 * - THIS_MEMBER: this.count <- 5
 * - MEMBER_CHAIN: struct.field.subfield <- value
 */
import AssignmentKind from "../AssignmentKind";
import IAssignmentContext from "../IAssignmentContext";
import BitUtils from "../../../../../utils/BitUtils";
import TAssignmentHandler from "./TAssignmentHandler";
import CodeGenState from "../../../../state/CodeGenState";

/**
 * Common handler for global access patterns (GLOBAL_MEMBER and GLOBAL_ARRAY).
 *
 * #1322: cross-scope visibility for the target is E0435/E0436 in pass 2.1;
 * this only generates the assignment.
 */
function handleGlobalAccess(ctx: IAssignmentContext): string {
  const target = CodeGenState.requireGenerator().generateAssignmentTarget(
    ctx.targetCtx,
  );
  return `${target} ${ctx.cOp} ${ctx.generatedValue};`;
}

/**
 * Handler for `this.member <- value` (THIS_MEMBER).
 *
 * Validates scope context and generates standard assignment.
 */
function handleThisAccess(ctx: IAssignmentContext): string {
  const target = CodeGenState.requireGenerator().generateAssignmentTarget(
    ctx.targetCtx,
  );
  return `${target} ${ctx.cOp} ${ctx.generatedValue};`;
}

/**
 * Handle member chain: struct.field.subfield <- value
 *
 * This is the catch-all for complex member access patterns
 * that don't match more specific handlers.
 *
 * Special case: Detects bit access at the end of chain
 * (e.g., grid[2][3].flags[0] <- true) and generates RMW.
 */
function handleMemberChain(ctx: IAssignmentContext): string {
  // Check if this is bit access on a struct member
  const bitAnalysis =
    CodeGenState.requireGenerator().analyzeMemberChainForBitAccess(
      ctx.targetCtx,
    );

  if (bitAnalysis.isBitAccess) {
    // #1322: compound assignment on this target is E0857 in pass 2.1.

    const { baseTarget, bitIndex, baseType } = bitAnalysis;
    const one = BitUtils.oneForType(baseType!);
    const intValue = BitUtils.boolToInt(ctx.generatedValue.trim());

    return `${baseTarget} = (${baseTarget} & ~(${one} << ${bitIndex})) | (${intValue} << ${bitIndex});`;
  }

  // Normal member chain assignment
  const target = CodeGenState.requireGenerator().generateAssignmentTarget(
    ctx.targetCtx,
  );
  return `${target} ${ctx.cOp} ${ctx.generatedValue};`;
}

/**
 * All access pattern handlers for registration.
 */
const accessPatternHandlers: ReadonlyArray<
  [AssignmentKind, TAssignmentHandler]
> = [
  [AssignmentKind.GLOBAL_MEMBER, handleGlobalAccess],
  [AssignmentKind.GLOBAL_ARRAY, handleGlobalAccess],
  [AssignmentKind.THIS_MEMBER, handleThisAccess],
  [AssignmentKind.MEMBER_CHAIN, handleMemberChain],
];

export default accessPatternHandlers;
