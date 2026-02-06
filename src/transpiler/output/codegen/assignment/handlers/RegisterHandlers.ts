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
import AssignmentHandlerUtils from "./AssignmentHandlerUtils";

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
  // Issue #707: Use shared validation utility
  AssignmentHandlerUtils.validateNoCompoundForBitAccess(
    ctx.isCompound,
    ctx.cnextOp,
  );

  const { fullName } =
    AssignmentHandlerUtils.buildRegisterNameWithScopeDetection(
      ctx.identifiers,
      deps.isKnownScope,
    );
  const accessMod = deps.symbols.registerMemberAccess.get(fullName);
  const isWriteOnly = RegisterUtils.isWriteOnlyRegister(accessMod);

  const bitIndex = deps.generateExpression(ctx.subscripts[0]);

  if (isWriteOnly) {
    AssignmentHandlerUtils.validateWriteOnlyValue(
      ctx.generatedValue,
      fullName,
      bitIndex,
      true,
    );
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
  // Issue #707: Use shared validation utility
  AssignmentHandlerUtils.validateNoCompoundForBitAccess(
    ctx.isCompound,
    ctx.cnextOp,
  );

  const { fullName, regName } =
    AssignmentHandlerUtils.buildRegisterNameWithScopeDetection(
      ctx.identifiers,
      deps.isKnownScope,
    );
  const accessMod = deps.symbols.registerMemberAccess.get(fullName);
  const isWriteOnly = RegisterUtils.isWriteOnlyRegister(accessMod);

  const start = deps.generateExpression(ctx.subscripts[0]);
  const width = deps.generateExpression(ctx.subscripts[1]);
  const mask = BitUtils.generateMask(width);

  if (isWriteOnly) {
    AssignmentHandlerUtils.validateWriteOnlyValue(
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
    return RegisterUtils.generateWriteOnlyBitRange(
      fullName,
      ctx.generatedValue,
      mask,
      start,
    );
  }

  // Read-write: read-modify-write
  return RegisterUtils.generateRmwBitRange(
    fullName,
    ctx.generatedValue,
    mask,
    start,
  );
}

/**
 * Handle scoped register single bit: this.GPIO7.DR_SET[bit] <- true
 */
function handleScopedRegisterBit(
  ctx: IAssignmentContext,
  deps: IHandlerDeps,
): string {
  // Issue #707: Use shared validation utilities
  AssignmentHandlerUtils.validateScopeContext(deps.currentScope);
  AssignmentHandlerUtils.validateNoCompoundForBitAccess(
    ctx.isCompound,
    ctx.cnextOp,
  );

  // Build scoped name: Scope_Register_Member
  const regName = AssignmentHandlerUtils.buildScopedRegisterName(
    deps.currentScope!,
    ctx.identifiers,
  );

  const accessMod = deps.symbols.registerMemberAccess.get(regName);
  const isWriteOnly = RegisterUtils.isWriteOnlyRegister(accessMod);

  const bitIndex = deps.generateExpression(ctx.subscripts[0]);

  if (isWriteOnly) {
    AssignmentHandlerUtils.validateWriteOnlyValue(
      ctx.generatedValue,
      regName,
      bitIndex,
      true,
    );
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
  // Issue #707: Use shared validation utilities
  AssignmentHandlerUtils.validateScopeContext(deps.currentScope);
  AssignmentHandlerUtils.validateNoCompoundForBitAccess(
    ctx.isCompound,
    ctx.cnextOp,
  );

  const scopeName = deps.currentScope!;
  const parts = ctx.identifiers;
  const regName = AssignmentHandlerUtils.buildScopedRegisterName(
    scopeName,
    parts,
  );
  const scopedRegName = `${scopeName}_${parts[0]}`;

  const accessMod = deps.symbols.registerMemberAccess.get(regName);
  const isWriteOnly = RegisterUtils.isWriteOnlyRegister(accessMod);

  const start = deps.generateExpression(ctx.subscripts[0]);
  const width = deps.generateExpression(ctx.subscripts[1]);
  const mask = `((1U << ${width}) - 1)`;

  if (isWriteOnly) {
    AssignmentHandlerUtils.validateWriteOnlyValue(
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
