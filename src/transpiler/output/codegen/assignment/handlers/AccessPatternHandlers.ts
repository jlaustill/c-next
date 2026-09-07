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
 * Emission for a qualified access target: `global.Counter.value <- 5`,
 * `global.obj.field[i] <- v`, `this.count <- 5`.
 *
 * #1322: there were two functions here, one per qualifier, and they became
 * byte-identical when the checks they differed by moved to pass 2.1 --
 * cross-scope visibility is E0435/E0436, and `this` outside a scope is E0431.
 * What was left was one expression written twice, with the `this` copy still
 * documented as "validates scope context", which it no longer did.
 *
 * The three assignment KINDS stay distinct: the classifier tells them apart,
 * and a future rule may need to. What is shared is the emission, and it is
 * shared by being one function rather than by two that happen to agree.
 */
function handleQualifiedAccess(ctx: IAssignmentContext): string {
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
  [AssignmentKind.GLOBAL_MEMBER, handleQualifiedAccess],
  [AssignmentKind.GLOBAL_ARRAY, handleQualifiedAccess],
  [AssignmentKind.THIS_MEMBER, handleQualifiedAccess],
  [AssignmentKind.MEMBER_CHAIN, handleMemberChain],
];

export default accessPatternHandlers;
