/**
 * Bitmap Header Generator
 *
 * Generates C typedef declarations for bitmap types from symbol information.
 * Bitmaps are represented as their backing integer type with a comment
 * documenting the bit field layout.
 */

import IHeaderTypeInput from "./IHeaderTypeInput";

/**
 * Generate a C typedef declaration for the given bitmap name.
 *
 * Output format includes a comment with field layout followed by typedef.
 *
 * @param name - The bitmap type name
 * @param input - Symbol information containing bitmap fields
 * @returns C typedef with field layout comment, or simple typedef if data unavailable
 */
function generateBitmapHeader(name: string, input: IHeaderTypeInput): string {
  const backingType = input.bitmapBackingType.get(name);

  // Graceful fallback if bitmap data not available
  if (!backingType) {
    return `/* Bitmap: ${name} (see implementation for layout) */`;
  }

  const fields = input.bitmapFields.get(name);
  const lines: string[] = [];

  // Generate field layout comment
  lines.push(`/* Bitmap: ${name}`);

  if (fields && fields.size > 0) {
    // Sort fields by offset for readable layout documentation
    const sortedFields = Array.from(fields.entries()).sort(
      ([, a], [, b]) => a.offset - b.offset,
    );

    for (const [fieldName, { offset, width }] of sortedFields) {
      if (width === 1) {
        lines.push(` *   ${fieldName}: bit ${offset}`);
      } else {
        const endBit = offset + width - 1;
        lines.push(
          ` *   ${fieldName}: bits ${offset}-${endBit} (${width} bits)`,
        );
      }
    }
  }

  lines.push(" */");
  lines.push(`typedef ${backingType} ${name};`);

  return lines.join("\n");
}

export default generateBitmapHeader;
