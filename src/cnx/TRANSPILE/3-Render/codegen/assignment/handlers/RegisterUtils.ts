/**
 * RegisterUtils
 * Shared utilities for register assignment handlers.
 *
 * Extracted from AccessPatternHandlers.ts and RegisterHandlers.ts to reduce duplication.
 */
import RegisterMmio from "../../../../2-Plan/RegisterMmio";
import RegisterAccessMode from "../../../../../utils/RegisterAccessMode";
import type TranspileState from "../../../../TranspileState";
import type TExpression from "../../../../../types/syntax/TExpression";

/** Result from MMIO optimization attempt */
interface IOptimizationResult {
  success: boolean;
  statement?: string;
}

/**
 * Utilities for register access patterns
 */
class RegisterUtils {
  /**
   * Try to generate MMIO-optimized memory access for byte-aligned writes.
   * Returns success: true with statement if optimization applicable, false otherwise.
   */
  static tryGenerateMMIO(
    fullName: string,
    regName: string,
    startConst: number | undefined,
    widthConst: number | undefined,
    value: string,
    state: TranspileState,
    renderExpression: (expr: TExpression) => string,
  ): IOptimizationResult {
    const accessType = RegisterMmio.accessType(startConst, widthConst);
    if (accessType === null) return { success: false };

    const base = state.symbols!.registerBaseAddresses.get(regName);
    const offset = state.symbols!.registerMemberOffsets.get(fullName);

    if (base === undefined || offset === undefined) {
      return { success: false };
    }
    // The same renderer the register macro spells them with (#1991)
    const baseAddr = renderExpression(base);
    const memberOffset = renderExpression(offset);

    const byteOffset = startConst! / 8;
    const totalOffset =
      byteOffset === 0 ? memberOffset : `${memberOffset} + ${byteOffset}`;

    return {
      success: true,
      statement: `*((volatile ${accessType}*)(${baseAddr} + ${totalOffset})) = (${value});`,
    };
  }
  /**
   * Check if register is write-only based on access modifier.
   *
   * Write-only registers include:
   * - 'wo': Write-only
   * - 'w1s': Write-1-to-set
   * - 'w1c': Write-1-to-clear
   */
  static isWriteOnlyRegister(accessMod: string | undefined): boolean {
    return RegisterAccessMode.isWriteOne(accessMod);
  }
}

export default RegisterUtils;
