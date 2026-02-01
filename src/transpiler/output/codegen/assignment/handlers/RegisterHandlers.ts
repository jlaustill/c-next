/**
 * Register bit assignment handlers (ADR-109).
 *
 * Handles assignments to register bits:
 * - REGISTER_BIT: GPIO7.DR_SET[LED_BIT] <- true
 * - REGISTER_BIT_RANGE: GPIO7.DR_SET[0, 8] <- value
 * - REGISTER_MEMORY_MAPPED: Width-appropriate MMIO access
 * - SCOPED_REGISTER_BIT: this.GPIO7.DR_SET[bit] <- true
 * - SCOPED_REGISTER_BIT_RANGE: this.GPIO7.ICR1[6, 2] <- value
 */
import AssignmentKind from "../AssignmentKind";
import IAssignmentContext from "../IAssignmentContext";
import IHandlerDeps from "./IHandlerDeps";
import BitUtils from "../../../../../utils/BitUtils";
import TypeCheckUtils from "../../../../../utils/TypeCheckUtils";
import TAssignmentHandler from "./TAssignmentHandler";
import RegisterUtils from "./RegisterUtils";

/**
 * Validate write-only register assignment value.
 * Throws if trying to clear bits on write-only register.
 */
function validateWriteOnlyValue(
  value: string,
  fullName: string,
  bitIndex: string,
  isSingleBit: boolean,
): void {
  if (isSingleBit && (value === "false" || value === "0")) {
    throw new Error(
      `Cannot assign false to write-only register bit ${fullName}[${bitIndex}]. ` +
        `Use the corresponding CLEAR register to clear bits.`,
    );
  }
  if (!isSingleBit && value === "0") {
    throw new Error(
      `Cannot assign 0 to write-only register bits ${fullName}[${bitIndex}]. ` +
        `Use the corresponding CLEAR register to clear bits.`,
    );
  }
}

/**
 * Build the full register member name from identifiers.
 */
function buildRegisterFullName(
  identifiers: readonly string[],
  deps: IHandlerDeps,
): { fullName: string; regName: string; isScoped: boolean } {
  const leadingId = identifiers[0];

  if (deps.isKnownScope(leadingId) && identifiers.length >= 3) {
    // Scoped: Scope.Register.Member
    const regName = `${leadingId}_${identifiers[1]}`;
    const fullName = `${regName}_${identifiers[2]}`;
    return { fullName, regName, isScoped: true };
  } else {
    // Non-scoped: Register.Member
    const regName = leadingId;
    const fullName = `${leadingId}_${identifiers[1]}`;
    return { fullName, regName, isScoped: false };
  }
}

/**
 * Try to generate MMIO-optimized memory access for byte-aligned writes.
 * Returns null if optimization not applicable.
 */
function tryGenerateMMIO(
  fullName: string,
  regName: string,
  startExpr: ReturnType<IHandlerDeps["tryEvaluateConstant"]>,
  widthExpr: ReturnType<IHandlerDeps["tryEvaluateConstant"]>,
  value: string,
  deps: IHandlerDeps,
): string | null {
  if (
    startExpr === undefined ||
    widthExpr === undefined ||
    startExpr % 8 !== 0 ||
    !TypeCheckUtils.isStandardWidth(widthExpr)
  ) {
    return null;
  }

  const baseAddr = deps.symbols.registerBaseAddresses.get(regName);
  const memberOffset = deps.symbols.registerMemberOffsets.get(fullName);

  if (baseAddr === undefined || memberOffset === undefined) {
    return null;
  }

  const byteOffset = startExpr / 8;
  const accessType = `uint${widthExpr}_t`;
  const totalOffset =
    byteOffset === 0 ? memberOffset : `${memberOffset} + ${byteOffset}`;

  return `*((volatile ${accessType}*)(${baseAddr} + ${totalOffset})) = (${value});`;
}

/**
 * Handle register single bit: GPIO7.DR_SET[LED_BIT] <- true
 */
function handleRegisterBit(
  ctx: IAssignmentContext,
  deps: IHandlerDeps,
): string {
  if (ctx.isCompound) {
    throw new Error(
      `Compound assignment operators not supported for bit field access: ${ctx.cnextOp}`,
    );
  }

  const { fullName } = buildRegisterFullName(ctx.identifiers, deps);
  const accessMod = deps.symbols.registerMemberAccess.get(fullName);
  const isWriteOnly = RegisterUtils.isWriteOnlyRegister(accessMod);

  const bitIndex = deps.generateExpression(ctx.subscripts[0]);

  if (isWriteOnly) {
    validateWriteOnlyValue(ctx.generatedValue, fullName, bitIndex, true);
    return `${fullName} = (1 << ${bitIndex});`;
  }

  return `${fullName} = (${fullName} & ~(1 << ${bitIndex})) | (${BitUtils.boolToInt(ctx.generatedValue)} << ${bitIndex});`;
}

/**
 * Handle register bit range: GPIO7.DR_SET[0, 8] <- value
 */
function handleRegisterBitRange(
  ctx: IAssignmentContext,
  deps: IHandlerDeps,
): string {
  if (ctx.isCompound) {
    throw new Error(
      `Compound assignment operators not supported for bit field access: ${ctx.cnextOp}`,
    );
  }

  const { fullName, regName } = buildRegisterFullName(ctx.identifiers, deps);
  const accessMod = deps.symbols.registerMemberAccess.get(fullName);
  const isWriteOnly = RegisterUtils.isWriteOnlyRegister(accessMod);

  const start = deps.generateExpression(ctx.subscripts[0]);
  const width = deps.generateExpression(ctx.subscripts[1]);
  const mask = BitUtils.generateMask(width);

  if (isWriteOnly) {
    validateWriteOnlyValue(
      ctx.generatedValue,
      fullName,
      `${start}, ${width}`,
      false,
    );

    // Try MMIO optimization
    const startConst = deps.tryEvaluateConstant(ctx.subscripts[0]);
    const widthConst = deps.tryEvaluateConstant(ctx.subscripts[1]);
    const mmio = tryGenerateMMIO(
      fullName,
      regName,
      startConst,
      widthConst,
      ctx.generatedValue,
      deps,
    );
    if (mmio) {
      return mmio;
    }

    // Fallback: write shifted value
    return `${fullName} = ((${ctx.generatedValue} & ${mask}) << ${start});`;
  }

  // Read-write: read-modify-write
  return `${fullName} = (${fullName} & ~(${mask} << ${start})) | ((${ctx.generatedValue} & ${mask}) << ${start});`;
}

/**
 * Handle scoped register single bit: this.GPIO7.DR_SET[bit] <- true
 */
function handleScopedRegisterBit(
  ctx: IAssignmentContext,
  deps: IHandlerDeps,
): string {
  if (!deps.currentScope) {
    throw new Error("Error: 'this' can only be used inside a scope");
  }

  if (ctx.isCompound) {
    throw new Error(
      `Compound assignment operators not supported for bit field access: ${ctx.cnextOp}`,
    );
  }

  // Build scoped name: Scope_Register_Member
  const scopeName = deps.currentScope;
  const parts = ctx.identifiers;
  const regName = `${scopeName}_${parts.join("_")}`;

  const accessMod = deps.symbols.registerMemberAccess.get(regName);
  const isWriteOnly = RegisterUtils.isWriteOnlyRegister(accessMod);

  const bitIndex = deps.generateExpression(ctx.subscripts[0]);

  if (isWriteOnly) {
    validateWriteOnlyValue(ctx.generatedValue, regName, bitIndex, true);
    return `${regName} = (1 << ${bitIndex});`;
  }

  return `${regName} = (${regName} & ~(1 << ${bitIndex})) | (${BitUtils.boolToInt(ctx.generatedValue)} << ${bitIndex});`;
}

/**
 * Handle scoped register bit range: this.GPIO7.ICR1[6, 2] <- value
 */
function handleScopedRegisterBitRange(
  ctx: IAssignmentContext,
  deps: IHandlerDeps,
): string {
  if (!deps.currentScope) {
    throw new Error("Error: 'this' can only be used inside a scope");
  }

  if (ctx.isCompound) {
    throw new Error(
      `Compound assignment operators not supported for bit field access: ${ctx.cnextOp}`,
    );
  }

  const scopeName = deps.currentScope;
  const parts = ctx.identifiers;
  const regName = `${scopeName}_${parts.join("_")}`;
  const scopedRegName = `${scopeName}_${parts[0]}`;

  const accessMod = deps.symbols.registerMemberAccess.get(regName);
  const isWriteOnly = RegisterUtils.isWriteOnlyRegister(accessMod);

  const start = deps.generateExpression(ctx.subscripts[0]);
  const width = deps.generateExpression(ctx.subscripts[1]);
  const mask = `((1U << ${width}) - 1)`;

  if (isWriteOnly) {
    validateWriteOnlyValue(
      ctx.generatedValue,
      regName,
      `${start}, ${width}`,
      false,
    );

    // Try MMIO optimization
    const startConst = deps.tryEvaluateConstant(ctx.subscripts[0]);
    const widthConst = deps.tryEvaluateConstant(ctx.subscripts[1]);

    if (
      startConst !== undefined &&
      widthConst !== undefined &&
      startConst % 8 === 0 &&
      TypeCheckUtils.isStandardWidth(widthConst)
    ) {
      const baseAddr = deps.symbols.registerBaseAddresses.get(scopedRegName);
      const memberOffset = deps.symbols.registerMemberOffsets.get(regName);

      if (baseAddr !== undefined && memberOffset !== undefined) {
        const byteOffset = startConst / 8;
        const accessType = `uint${widthConst}_t`;
        const totalOffset =
          byteOffset === 0 ? memberOffset : `${memberOffset} + ${byteOffset}`;
        return `*((volatile ${accessType}*)(${baseAddr} + ${totalOffset})) = (${ctx.generatedValue});`;
      }
    }

    return `${regName} = ((${ctx.generatedValue} & ${mask}) << ${start});`;
  }

  return `${regName} = (${regName} & ~(${mask} << ${start})) | ((${ctx.generatedValue} & ${mask}) << ${start});`;
}

/**
 * All register handlers for registration.
 */
const registerHandlers: ReadonlyArray<[AssignmentKind, TAssignmentHandler]> = [
  [AssignmentKind.REGISTER_BIT, handleRegisterBit],
  [AssignmentKind.REGISTER_BIT_RANGE, handleRegisterBitRange],
  [AssignmentKind.SCOPED_REGISTER_BIT, handleScopedRegisterBit],
  [AssignmentKind.SCOPED_REGISTER_BIT_RANGE, handleScopedRegisterBitRange],
];

export default registerHandlers;
