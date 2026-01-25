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
import BitUtils from "../../../utils/BitUtils";
import TAssignmentHandler from "./TAssignmentHandler";

/**
 * Check if register is write-only.
 */
function isWriteOnlyRegister(accessMod: string | undefined): boolean {
  return accessMod === "wo" || accessMod === "w1s" || accessMod === "w1c";
}

/**
 * Handle global.member: global.Counter.value <- 5
 */
function handleGlobalMember(
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
 * Handle global.arr[i]: global.arr[i] <- value
 */
function handleGlobalArray(
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
  const isWriteOnly = isWriteOnlyRegister(accessMod);

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
      return `${regName} = ((${ctx.generatedValue} & ${mask}) << ${start});`;
    }
    return `${regName} = (${regName} & ~(${mask} << ${start})) | ((${ctx.generatedValue} & ${mask}) << ${start});`;
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
 * Handle this.member: this.count <- 5
 */
function handleThisMember(ctx: IAssignmentContext, deps: IHandlerDeps): string {
  if (!deps.currentScope) {
    throw new Error("Error: 'this' can only be used inside a scope");
  }

  const target = deps.generateAssignmentTarget(ctx.targetCtx);
  return `${target} ${ctx.cOp} ${ctx.generatedValue};`;
}

/**
 * Handle this.arr[i]: this.items[i] <- value
 */
function handleThisArray(ctx: IAssignmentContext, deps: IHandlerDeps): string {
  if (!deps.currentScope) {
    throw new Error("Error: 'this' can only be used inside a scope");
  }

  const target = deps.generateAssignmentTarget(ctx.targetCtx);
  return `${target} ${ctx.cOp} ${ctx.generatedValue};`;
}

/**
 * Handle member chain: struct.field.subfield <- value
 *
 * This is the catch-all for complex member access patterns
 * that don't match more specific handlers.
 */
function handleMemberChain(
  ctx: IAssignmentContext,
  deps: IHandlerDeps,
): string {
  const target = deps.generateAssignmentTarget(ctx.targetCtx);
  return `${target} ${ctx.cOp} ${ctx.generatedValue};`;
}

/**
 * All access pattern handlers for registration.
 */
const accessPatternHandlers: ReadonlyArray<
  [AssignmentKind, TAssignmentHandler]
> = [
  [AssignmentKind.GLOBAL_MEMBER, handleGlobalMember],
  [AssignmentKind.GLOBAL_ARRAY, handleGlobalArray],
  [AssignmentKind.GLOBAL_REGISTER_BIT, handleGlobalRegisterBit],
  [AssignmentKind.THIS_MEMBER, handleThisMember],
  [AssignmentKind.THIS_ARRAY, handleThisArray],
  [AssignmentKind.MEMBER_CHAIN, handleMemberChain],
];

export default accessPatternHandlers;
