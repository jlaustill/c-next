/**
 * Bitmap Comment Utilities
 *
 * Shared utility for generating bitmap field layout comments.
 * Issue #707: Extracted from BitmapGenerator.ts and ScopeGenerator.ts
 * to reduce code duplication.
 */

/**
 * Bitmap field information
 */
interface IBitmapFieldInfo {
  offset: number;
  width: number;
}

/**
 * Generate comment lines describing bitmap field layout.
 *
 * @param fields - Map of field names to their offset/width info
 * @returns Array of comment lines (without leading spaces)
 *
 * @example
 * // Output format:
 * // /* Fields:
 * //  *   Running: bit 0 (1 bit)
 * //  *   Mode: bits 2-4 (3 bits)
 * //  * /
 */
function generateBitmapFieldComments(
  fields: ReadonlyMap<string, IBitmapFieldInfo>,
): string[] {
  const lines: string[] = [];
  lines.push("/* Fields:");

  for (const [fieldName, info] of fields.entries()) {
    const endBit = info.offset + info.width - 1;
    const bitRange =
      info.width === 1 ? `bit ${info.offset}` : `bits ${info.offset}-${endBit}`;
    lines.push(
      ` *   ${fieldName}: ${bitRange} (${info.width} bit${info.width > 1 ? "s" : ""})`,
    );
  }

  lines.push(" */");
  return lines;
}

/**
 * Bitmap Comment Utilities
 */
class BitmapCommentUtils {
  static generateBitmapFieldComments = generateBitmapFieldComments;
}

export default BitmapCommentUtils;
