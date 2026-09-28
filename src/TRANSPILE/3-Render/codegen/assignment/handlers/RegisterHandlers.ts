/**
 * Register bit assignment handlers (ADR-065).
 *
 * Handles assignments to register bits:
 * - REGISTER_BIT: GPIO7.DR_SET[LED_BIT] <- true
 * - REGISTER_BIT_RANGE: GPIO7.DR_SET[0, 8] <- value
 * - REGISTER_MEMORY_MAPPED: Width-appropriate MMIO access
 * - SCOPED_REGISTER_BIT: this.GPIO7.DR_SET[bit] <- true
 * - SCOPED_REGISTER_BIT_RANGE: this.GPIO7.ICR1[6, 2] <- value
 */
import AssignmentKind from "../../../../../transpiler/types/AssignmentKind";
import IAssignmentContext from "../../../../2-Plan/types/IAssignmentContext";
import BitUtils from "../../../../../utils/BitUtils";
import TAssignmentHandler from "./TAssignmentHandler";
import RegisterUtils from "./RegisterUtils";
import AssignmentHandlerUtils from "./AssignmentHandlerUtils";
import QualifiedNameGenerator from "../../../../../utils/QualifiedNameGenerator";

/**
 * A bit of a register member. A write-1 member (`wo`, `w1s`, `w1c`) is
 * written without being read, and takes the value it is given: a runtime
 * zero is written as one, which the hardware ignores (#1775).
 */
function writeRegisterBit(ctx: IAssignmentContext, memberName: string): string {
  const accessMod = ctx.state.symbols!.registerMemberAccess.get(memberName);
  const storage = ctx.state.symbols!.registerMemberCTypes.get(memberName);
  const bitIndex = ctx.renderSubscript(0);

  if (RegisterUtils.isWriteOnlyRegister(accessMod)) {
    AssignmentHandlerUtils.validateWriteOnlyValue(
      ctx.generatedValue,
      memberName,
      bitIndex,
      true,
    );
    return BitUtils.writeOnlySingleBit(
      memberName,
      bitIndex,
      ctx.generatedValue,
      storage,
    );
  }

  return BitUtils.singleBitWrite(
    memberName,
    bitIndex,
    ctx.generatedValue,
    storage,
  );
}

/**
 * A bit range of a register member. A write-1 member takes a plain write,
 * as a byte-aligned memory access when the range allows one.
 *
 * @param regName the register itself, whose base address the memory access uses
 */
function writeRegisterBitRange(
  ctx: IAssignmentContext,
  memberName: string,
  regName: string,
): string {
  const accessMod = ctx.state.symbols!.registerMemberAccess.get(memberName);
  const storage = ctx.state.symbols!.registerMemberCTypes.get(memberName);
  const start = ctx.renderSubscript(0);
  // With its fold (#1096): a register's `[0, W]` masked a runtime `1U << 32`
  const width = { text: ctx.renderSubscript(1), folded: ctx.foldSubscript(1) };

  if (RegisterUtils.isWriteOnlyRegister(accessMod)) {
    AssignmentHandlerUtils.validateWriteOnlyValue(
      ctx.generatedValue,
      memberName,
      `${start}, ${width.text}`,
      false,
    );

    const mmio = RegisterUtils.tryGenerateMMIO(
      memberName,
      regName,
      ctx.foldSubscript(0),
      width.folded,
      ctx.generatedValue,
      ctx.state,
    );
    if (mmio.success) {
      return mmio.statement!;
    }

    return BitUtils.writeOnlyMultiBit(
      memberName,
      start,
      width,
      ctx.generatedValue,
      storage,
    );
  }

  return BitUtils.multiBitWrite(
    memberName,
    start,
    width,
    ctx.generatedValue,
    storage,
  );
}

/**
 * Handle register single bit: GPIO7.DR_SET[LED_BIT] <- true
 */
function handleRegisterBit(ctx: IAssignmentContext): string {
  const { fullName } =
    AssignmentHandlerUtils.buildRegisterNameWithScopeDetection(
      ctx.identifiers,
      (name) => ctx.state.isKnownScope(name),
    );
  return writeRegisterBit(ctx, fullName);
}

/**
 * Handle register bit range: GPIO7.DR_SET[0, 8] <- value
 */
function handleRegisterBitRange(ctx: IAssignmentContext): string {
  const { fullName, regName } =
    AssignmentHandlerUtils.buildRegisterNameWithScopeDetection(
      ctx.identifiers,
      (name) => ctx.state.isKnownScope(name),
    );
  return writeRegisterBitRange(ctx, fullName, regName);
}

/**
 * Handle scoped register single bit: this.GPIO7.DR_SET[bit] <- true
 */
function handleScopedRegisterBit(ctx: IAssignmentContext): string {
  // Build scoped name: Scope_Register_Member
  const regName = AssignmentHandlerUtils.buildScopedRegisterName(
    ctx.state.currentScopePath,
    ctx.identifiers,
  );
  return writeRegisterBit(ctx, regName);
}

/**
 * Handle scoped register bit range: this.GPIO7.ICR1[6, 2] <- value
 */
function handleScopedRegisterBitRange(ctx: IAssignmentContext): string {
  // #1298: `currentScopePath` IS the whole enclosing path. A scope's leaf name
  // discards every outer component -- the exact leaf-only encoder #1285 removed
  // -- so pass the path on unmodified.
  const declaringScopePath = ctx.state.currentScopePath;
  const parts = ctx.identifiers;
  const regName = AssignmentHandlerUtils.buildScopedRegisterName(
    declaringScopePath,
    parts,
  );
  const scopedRegName = QualifiedNameGenerator.forMember(
    declaringScopePath,
    parts[0],
  );
  return writeRegisterBitRange(ctx, regName, scopedRegName);
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
