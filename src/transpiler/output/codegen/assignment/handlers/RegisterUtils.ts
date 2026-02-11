/**
 * RegisterUtils
 * Shared utilities for register assignment handlers.
 *
 * Extracted from AccessPatternHandlers.ts and RegisterHandlers.ts to reduce duplication.
 */
import BitUtils from "../../../../../utils/BitUtils";
import TypeCheckUtils from "../../../../../utils/TypeCheckUtils";
import CodeGenState from "../../../../state/CodeGenState";

/** Result from extracting bit range expressions */
interface IBitRangeParams {
  start: string;
  width: string;
  mask: string;
}

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
   * Extract start, width, and mask from bit range subscripts.
   * Consolidates the common pattern of getting expressions and generating mask.
   */
  static extractBitRangeParams(
    subscripts: readonly unknown[],
  ): IBitRangeParams {
    const start = CodeGenState.generator!.generateExpression(subscripts[0]);
    const width = CodeGenState.generator!.generateExpression(subscripts[1]);
    const mask = BitUtils.generateMask(width);
    return { start, width, mask };
  }

  /**
   * Try to generate MMIO-optimized memory access for byte-aligned writes.
   * Returns success: true with statement if optimization applicable, false otherwise.
   */
  static tryGenerateMMIO(
    fullName: string,
    regName: string,
    subscripts: readonly unknown[],
    value: string,
  ): IOptimizationResult {
    const startConst = CodeGenState.generator!.tryEvaluateConstant(
      subscripts[0],
    );
    const widthConst = CodeGenState.generator!.tryEvaluateConstant(
      subscripts[1],
    );

    if (
      startConst === undefined ||
      widthConst === undefined ||
      startConst % 8 !== 0 ||
      !TypeCheckUtils.isStandardWidth(widthConst)
    ) {
      return { success: false };
    }

    const baseAddr = CodeGenState.symbols!.registerBaseAddresses.get(regName);
    const memberOffset =
      CodeGenState.symbols!.registerMemberOffsets.get(fullName);

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
    return accessMod === "wo" || accessMod === "w1s" || accessMod === "w1c";
  }

  /**
   * Generate write-only bit range assignment statement.
   * Pattern: regName = ((value & mask) << start)
   */
  static generateWriteOnlyBitRange(
    regName: string,
    value: string,
    mask: string,
    start: string,
  ): string {
    return `${regName} = ((${value} & ${mask}) << ${start});`;
  }

  /**
   * Generate read-modify-write bit range assignment statement.
   * Pattern: regName = (regName & ~(mask << start)) | ((value & mask) << start)
   */
  static generateRmwBitRange(
    regName: string,
    value: string,
    mask: string,
    start: string,
  ): string {
    return `${regName} = (${regName} & ~(${mask} << ${start})) | ((${value} & ${mask}) << ${start});`;
  }
}

export default RegisterUtils;
