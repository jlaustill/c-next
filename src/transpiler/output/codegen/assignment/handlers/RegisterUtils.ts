/**
 * RegisterUtils
 * Shared utilities for register assignment handlers.
 *
 * Extracted from AccessPatternHandlers.ts and RegisterHandlers.ts to reduce duplication.
 */

/**
 * Utilities for register access patterns
 */
class RegisterUtils {
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
