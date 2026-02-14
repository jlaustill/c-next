/**
 * BitmapCollector - Extracts bitmap type declarations from parse trees.
 * ADR-034: Bitmaps provide named access to bit regions within an integer backing type.
 *
 * Produces TType-based IBitmapSymbol with proper IScopeSymbol references.
 */

import * as Parser from "../../../parser/grammar/CNextParser";
import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import IBitmapSymbol from "../../../../types/symbols/IBitmapSymbol";
import IBitmapFieldInfo from "../../../../types/symbols/IBitmapFieldInfo";
import IScopeSymbol from "../../../../types/symbols/IScopeSymbol";
import BITMAP_SIZE from "../../../../constants/BITMAP_SIZE";
import BITMAP_BACKING_TYPE from "../../../../constants/BITMAP_BACKING_TYPE";

class BitmapCollector {
  /**
   * Collect a bitmap declaration and return an IBitmapSymbol.
   *
   * @param ctx The bitmap declaration context
   * @param sourceFile Source file path
   * @param scope The scope this bitmap belongs to (IScopeSymbol)
   * @returns The bitmap symbol with proper scope reference
   * @throws Error if total bits don't match bitmap size
   */
  static collect(
    ctx: Parser.BitmapDeclarationContext,
    sourceFile: string,
    scope: IScopeSymbol,
  ): IBitmapSymbol {
    const name = ctx.IDENTIFIER().getText();
    const bitmapType = ctx.bitmapType().getText();
    const expectedBits = BITMAP_SIZE[bitmapType];
    const backingType = BITMAP_BACKING_TYPE[bitmapType];
    const line = ctx.start?.line ?? 0;

    // Collect fields with running bit offset
    const fields = new Map<string, IBitmapFieldInfo>();
    let totalBits = 0;

    for (const member of ctx.bitmapMember()) {
      const fieldName = member.IDENTIFIER().getText();
      const widthLiteral = member.INTEGER_LITERAL();
      const width = widthLiteral
        ? Number.parseInt(widthLiteral.getText(), 10)
        : 1;

      fields.set(fieldName, { offset: totalBits, width });
      totalBits += width;
    }

    // Validate total bits equals bitmap size
    if (totalBits !== expectedBits) {
      throw new Error(
        `Error: Bitmap '${name}' has ${totalBits} bits but ${bitmapType} requires exactly ${expectedBits} bits`,
      );
    }

    return {
      kind: "bitmap",
      name,
      scope,
      sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.CNext,
      isExported: true,
      backingType,
      bitWidth: expectedBits,
      fields,
    };
  }
}

export default BitmapCollector;
