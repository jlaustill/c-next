/**
 * Target platform capabilities for code generation
 * Determines which atomic instructions and features are available
 */

interface ITargetCapabilities {
  /** Bit width of target's native word (8, 16, or 32) */
  wordSize: 8 | 16 | 32;
  /** Does the target have Load-Exclusive/Store-Exclusive instructions? */
  hasLdrexStrex: boolean;
  /** Does the target have BASEPRI (priority masking)? */
  hasBasepri: boolean;
  /**
   * Number of significant initial characters in an external identifier.
   * C99 guarantees 31; older C standards guarantee 6.
   * Used for MISRA C:2012 Rule 5.1 (external identifiers shall be distinct).
   */
  significantExternalIdentifierChars: number;
  /**
   * Number of significant initial characters in an internal identifier.
   * C99 guarantees 63.
   *
   * Recorded but not yet enforced: MISRA C:2012 Rule 5.9 needs the same
   * collision check over `static` (private) members. Tracked as #1338.
   */
  significantInternalIdentifierChars: number;
}

export default ITargetCapabilities;
