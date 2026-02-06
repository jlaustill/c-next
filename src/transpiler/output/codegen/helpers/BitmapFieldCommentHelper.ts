/**
 * BitmapFieldCommentHelper - Generates comment documentation for bitmap fields.
 *
 * Shared between BitmapGenerator and ScopeGenerator to avoid duplication.
 */

import IBitmapFieldInfo from "../../../logic/symbols/types/IBitmapFieldInfo";

class BitmapFieldCommentHelper {
  /**
   * Generate comment lines for bitmap field documentation.
   *
   * @param fields - Map of field names to their bitmap info (supports ReadonlyMap)
   * @param lines - Array to push generated comment lines to
   */
  static generateFieldComments(
    fields: ReadonlyMap<string, IBitmapFieldInfo>,
    lines: string[],
  ): void {
    lines.push("/* Fields:");
    for (const [fieldName, info] of fields.entries()) {
      const endBit = info.offset + info.width - 1;
      const bitRange =
        info.width === 1
          ? `bit ${info.offset}`
          : `bits ${info.offset}-${endBit}`;
      lines.push(
        ` *   ${fieldName}: ${bitRange} (${info.width} bit${info.width > 1 ? "s" : ""})`,
      );
    }
    lines.push(" */");
  }
}

export default BitmapFieldCommentHelper;
