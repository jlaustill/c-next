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
}

export default RegisterUtils;
