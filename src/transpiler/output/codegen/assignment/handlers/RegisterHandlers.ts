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
import BitUtils from "../../../../../utils/BitUtils";
import TAssignmentHandler from "./TAssignmentHandler";
import RegisterUtils from "./RegisterUtils";
import AssignmentHandlerUtils from "./AssignmentHandlerUtils";
import CodeGenState from "../../../../state/CodeGenState";
import type ICodeGenApi from "../../types/ICodeGenApi";
import QualifiedNameGenerator from "../../utils/QualifiedNameGenerator";

/** Get typed generator reference */
function gen(): ICodeGenApi {
  return CodeGenState.generator as ICodeGenApi;
}

/**
 * Handle register single bit: GPIO7.DR_SET[LED_BIT] <- true
 */
function handleRegisterBit(ctx: IAssignmentContext): string {
  // Issue #707: Use shared validation utility
  AssignmentHandlerUtils.validateNoCompoundForBitAccess(
    ctx.isCompound,
    ctx.cnextOp,
  );

  const { fullName } =
    AssignmentHandlerUtils.buildRegisterNameWithScopeDetection(
      ctx.identifiers,
      (name) => CodeGenState.isKnownScope(name),
    );
  const accessMod = CodeGenState.symbols!.registerMemberAccess.get(fullName);
  const isWriteOnly = RegisterUtils.isWriteOnlyRegister(accessMod);

  const bitIndex = gen().generateExpression(ctx.subscripts[0]);

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
function handleRegisterBitRange(ctx: IAssignmentContext): string {
  // Issue #707: Use shared validation utility
  AssignmentHandlerUtils.validateNoCompoundForBitAccess(
    ctx.isCompound,
    ctx.cnextOp,
  );

  const { fullName, regName } =
    AssignmentHandlerUtils.buildRegisterNameWithScopeDetection(
      ctx.identifiers,
      (name) => CodeGenState.isKnownScope(name),
    );
  const accessMod = CodeGenState.symbols!.registerMemberAccess.get(fullName);
  const isWriteOnly = RegisterUtils.isWriteOnlyRegister(accessMod);

  const { start, width, mask } = RegisterUtils.extractBitRangeParams(
    ctx.subscripts,
  );

  if (isWriteOnly) {
    AssignmentHandlerUtils.validateWriteOnlyValue(
      ctx.generatedValue,
      fullName,
      `${start}, ${width}`,
      false,
    );

    // Try MMIO optimization
    const mmio = RegisterUtils.tryGenerateMMIO(
      fullName,
      regName,
      ctx.subscripts,
      ctx.generatedValue,
    );
    if (mmio.success) {
      return mmio.statement!;
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
function handleScopedRegisterBit(ctx: IAssignmentContext): string {
  // Issue #707: Use shared validation utilities
  AssignmentHandlerUtils.validateScopeContext(CodeGenState.currentScope);
  AssignmentHandlerUtils.validateNoCompoundForBitAccess(
    ctx.isCompound,
    ctx.cnextOp,
  );

  // Build scoped name: Scope_Register_Member
  const regName = AssignmentHandlerUtils.buildScopedRegisterName(
    CodeGenState.currentScope!,
    ctx.identifiers,
  );

  const accessMod = CodeGenState.symbols!.registerMemberAccess.get(regName);
  const isWriteOnly = RegisterUtils.isWriteOnlyRegister(accessMod);

  const bitIndex = gen().generateExpression(ctx.subscripts[0]);

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
function handleScopedRegisterBitRange(ctx: IAssignmentContext): string {
  // Issue #707: Use shared validation utilities
  AssignmentHandlerUtils.validateScopeContext(CodeGenState.currentScope);
  AssignmentHandlerUtils.validateNoCompoundForBitAccess(
    ctx.isCompound,
    ctx.cnextOp,
  );

  const scopeName = CodeGenState.currentScope!;
  const parts = ctx.identifiers;
  const regName = AssignmentHandlerUtils.buildScopedRegisterName(
    scopeName,
    parts,
  );
  const scopedRegName = QualifiedNameGenerator.forMember(scopeName, parts[0]);

  const accessMod = CodeGenState.symbols!.registerMemberAccess.get(regName);
  const isWriteOnly = RegisterUtils.isWriteOnlyRegister(accessMod);

  const { start, width, mask } = RegisterUtils.extractBitRangeParams(
    ctx.subscripts,
  );

  if (isWriteOnly) {
    AssignmentHandlerUtils.validateWriteOnlyValue(
      ctx.generatedValue,
      regName,
      `${start}, ${width}`,
      false,
    );

    // Try MMIO optimization
    const mmio = RegisterUtils.tryGenerateMMIO(
      regName,
      scopedRegName,
      ctx.subscripts,
      ctx.generatedValue,
    );
    if (mmio.success) {
      return mmio.statement!;
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
