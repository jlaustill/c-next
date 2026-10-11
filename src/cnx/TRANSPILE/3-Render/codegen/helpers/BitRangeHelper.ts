/**
 * Helper utilities for generating bit range access code.
 * Extracted from CodeGenerator to improve testability.
 */

/**
 * Helper class for bit range access code generation.
 */
class BitRangeHelper {
  /**
   * Generate the shadow variable name for float bit access.
   *
   * #1322: the single encoder. The same `__bits_` prefix was also built inline
   * in `FloatBitHelper`, in `PostfixExpressionGenerator`'s float bit-range
   * path, and in the assignment path that invalidates a shadow -- four homes
   * for one decision, so changing the prefix meant four edits and any missed
   * one would have written a shadow under a name nothing read back. The three
   * others call this now.
   */
  static getShadowVarName(rawName: string): string {
    return `__bits_${rawName}`;
  }
}

export default BitRangeHelper;
