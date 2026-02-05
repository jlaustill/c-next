/**
 * BitmapAccessHelper - Shared bitmap field access generation
 *
 * Deduplicates the bitmap field lookup + access pattern that was
 * previously repeated 3 times in generateMemberAccess:
 * - Primary bitmap type field access
 * - Register member bitmap type field access
 * - Struct member bitmap type field access
 */
import accessGenerators from "./AccessExprGenerator";
import TGeneratorEffect from "../TGeneratorEffect";

interface BitmapAccessResult {
  code: string;
  effects: readonly TGeneratorEffect[];
}

class BitmapAccessHelper {
  /**
   * Generate bitmap field access code.
   *
   * Looks up the field in the bitmap's field map. If found, delegates to
   * accessGenerators.generateBitmapFieldAccess. If not found, throws with
   * a descriptive error.
   *
   * @param result - The current expression result (e.g., "status", "MOTOR_CTRL")
   * @param memberName - The bitmap field name (e.g., "Running")
   * @param bitmapType - The bitmap type name (e.g., "Status", "CtrlBits")
   * @param bitmapFields - Map of bitmap type -> field map
   * @param errorDescriptor - Full descriptor for error (e.g., "type 'Status'", "register member 'X' (bitmap type 'Y')")
   * @returns Generated code and effects
   */
  static generate(
    result: string,
    memberName: string,
    bitmapType: string,
    bitmapFields: ReadonlyMap<
      string,
      ReadonlyMap<string, { readonly offset: number; readonly width: number }>
    >,
    errorDescriptor: string,
  ): BitmapAccessResult {
    const fields = bitmapFields.get(bitmapType);
    if (fields?.has(memberName)) {
      const fieldInfo = fields.get(memberName)!;
      const bitmapResult = accessGenerators.generateBitmapFieldAccess(
        result,
        fieldInfo,
      );
      return { code: bitmapResult.code, effects: bitmapResult.effects };
    }
    throw new Error(
      `Error: Unknown bitmap field '${memberName}' on ${errorDescriptor}`,
    );
  }
}

export default BitmapAccessHelper;
