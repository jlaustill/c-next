/**
 * RegisterUtils
 * Shared utilities for register assignment handlers.
 *
 * Extracted from AccessPatternHandlers.ts and RegisterHandlers.ts to reduce duplication.
 */
import TypeCheckUtils from "../../../../../utils/TypeCheckUtils";
import RegisterAccessMode from "../../../../../utils/RegisterAccessMode";
import type TranspileState from "../../../../TranspileState";

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
  ): IOptimizationResult {
    if (
      startConst === undefined ||
      widthConst === undefined ||
      startConst % 8 !== 0 ||
      !TypeCheckUtils.isStandardWidth(widthConst)
    ) {
      return { success: false };
    }

    const baseAddr = state.symbols!.registerBaseAddresses.get(regName);
    const memberOffset = state.symbols!.registerMemberOffsets.get(fullName);

    if (baseAddr === undefined || memberOffset === undefined) {
      return { success: false };
    }

    const byteOffset = startConst / 8;
    const accessType = `uint${widthConst}_t`;
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
