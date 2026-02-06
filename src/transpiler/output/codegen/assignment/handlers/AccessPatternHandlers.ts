/**
 * Access pattern assignment handlers (ADR-109).
 *
 * Handles assignments with global/this prefix and member chains:
 * - GLOBAL_MEMBER: global.Counter.value <- 5
 * - GLOBAL_ARRAY: global.arr[i] <- value
 * - GLOBAL_REGISTER_BIT: global.GPIO7.DR_SET[bit] <- true
 * - THIS_MEMBER: this.count <- 5
 * - THIS_ARRAY: this.items[i] <- value
 * - MEMBER_CHAIN: struct.field.subfield <- value
 */
import AssignmentKind from "../AssignmentKind";
import IAssignmentContext from "../IAssignmentContext";
import IHandlerDeps from "./IHandlerDeps";
import BitUtils from "../../../../../utils/BitUtils";
import TAssignmentHandler from "./TAssignmentHandler";
import RegisterUtils from "./RegisterUtils";

/**
 * Common handler for global access patterns (GLOBAL_MEMBER and GLOBAL_ARRAY).
 *
 * Validates cross-scope visibility and generates standard assignment.
 */
function handleGlobalAccess(
  ctx: IAssignmentContext,
  deps: IHandlerDeps,
): string {
  const firstId = ctx.identifiers[0];

  // Validate cross-scope visibility if first id is a scope
  if (deps.isKnownScope(firstId) && ctx.identifiers.length >= 2) {
    deps.validateCrossScopeVisibility(firstId, ctx.identifiers[1]);
  }

  const target = deps.generateAssignmentTarget(ctx.targetCtx);
  return `${target} ${ctx.cOp} ${ctx.generatedValue};`;
}

/**
 * Common handler for this access patterns (THIS_MEMBER and THIS_ARRAY).
 *
 * Validates scope context and generates standard assignment.
 */
function handleThisAccess(ctx: IAssignmentContext, deps: IHandlerDeps): string {
  if (!deps.currentScope) {
    throw new Error("Error: 'this' can only be used inside a scope");
  }

  const target = deps.generateAssignmentTarget(ctx.targetCtx);
  return `${target} ${ctx.cOp} ${ctx.generatedValue};`;
}

/**
 * Handle global.reg[bit]: global.GPIO7.DR_SET[bit] <- true
 */
function handleGlobalRegisterBit(
  ctx: IAssignmentContext,
  deps: IHandlerDeps,
): string {
  if (ctx.isCompound) {
    throw new Error(
      `Compound assignment operators not supported for bit field access: ${ctx.cnextOp}`,
    );
  }

  const parts = ctx.identifiers;
  const regName = parts.join("_");

  // Check for write-only register
  const accessMod = deps.symbols.registerMemberAccess.get(regName);
  const isWriteOnly = RegisterUtils.isWriteOnlyRegister(accessMod);

  // Handle bit range vs single bit
  if (ctx.subscripts.length === 2) {
    // Bit range
    const start = deps.generateExpression(ctx.subscripts[0]);
    const width = deps.generateExpression(ctx.subscripts[1]);
    const mask = BitUtils.generateMask(width);

    if (isWriteOnly) {
      if (ctx.generatedValue === "0") {
        throw new Error(
          `Cannot assign 0 to write-only register bits ${regName}[${start}, ${width}]. ` +
            `Use the corresponding CLEAR register to clear bits.`,
        );
      }
      return RegisterUtils.generateWriteOnlyBitRange(
        regName,
        ctx.generatedValue,
        mask,
        start,
      );
    }
    return RegisterUtils.generateRmwBitRange(
      regName,
      ctx.generatedValue,
      mask,
      start,
    );
  }

  // Single bit
  const bitIndex = deps.generateExpression(ctx.subscripts[0]);

  if (isWriteOnly) {
    if (ctx.generatedValue === "false" || ctx.generatedValue === "0") {
      throw new Error(
        `Cannot assign false to write-only register bit ${regName}[${bitIndex}]. ` +
          `Use the corresponding CLEAR register to clear bits.`,
      );
    }
    return `${regName} = (1 << ${bitIndex});`;
  }

  return `${regName} = (${regName} & ~(1 << ${bitIndex})) | (${BitUtils.boolToInt(ctx.generatedValue)} << ${bitIndex});`;
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
function handleMemberChain(
  ctx: IAssignmentContext,
  deps: IHandlerDeps,
): string {
  // Check if this is bit access on a struct member
  const bitAnalysis = deps.analyzeMemberChainForBitAccess(ctx.targetCtx);

  if (bitAnalysis.isBitAccess) {
    // Validate compound operators not supported for bit access
    if (ctx.isCompound) {
      throw new Error(
        `Compound assignment operators not supported for bit field access: ${ctx.cnextOp}`,
      );
    }

    const { baseTarget, bitIndex, baseType } = bitAnalysis;
    const one = BitUtils.oneForType(baseType!);
    const intValue = BitUtils.boolToInt(ctx.generatedValue.trim());

    return `${baseTarget} = (${baseTarget} & ~(${one} << ${bitIndex})) | (${intValue} << ${bitIndex});`;
  }

  // Normal member chain assignment
  const target = deps.generateAssignmentTarget(ctx.targetCtx);
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
  [AssignmentKind.GLOBAL_REGISTER_BIT, handleGlobalRegisterBit],
  [AssignmentKind.THIS_MEMBER, handleThisAccess],
  [AssignmentKind.THIS_ARRAY, handleThisAccess],
  [AssignmentKind.MEMBER_CHAIN, handleMemberChain],
];

export default accessPatternHandlers;
