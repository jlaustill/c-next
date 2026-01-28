/**
 * Pure utility functions for function call expression generation.
 * Extracted from CallExprGenerator for testability (Issue #420).
 */
import TYPE_MAP from "../../types/TYPE_MAP";

class CallExprUtils {
  /**
   * Issue #304: Map C-Next type to C type for static_cast.
   * Returns the input unchanged if not a known C-Next primitive type.
   */
  static mapTypeToCType(cnxType: string): string {
    return TYPE_MAP[cnxType] || cnxType;
  }
}

export default CallExprUtils;
