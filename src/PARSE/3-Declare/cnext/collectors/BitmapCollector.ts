/**
 * BitmapCollector - Extracts bitmap type declarations from parse trees.
 * ADR-034: Bitmaps provide named access to bit regions within an integer backing type.
 *
 * Produces TType-based IBitmapSymbol with proper IScopeSymbol references.
 */

import * as Parser from "../../../../transpiler/logic/parser/grammar/CNextParser";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import IBitmapSymbol from "../../../../transpiler/types/symbols/IBitmapSymbol";
import type IBitmapFieldSymbol from "../../../../transpiler/types/symbols/IBitmapFieldSymbol";
import BITMAP_SIZE from "../../../../transpiler/constants/BITMAP_SIZE";
import BITMAP_BACKING_TYPE from "../../../../transpiler/constants/BITMAP_BACKING_TYPE";
import ScopeUtils from "../../../../utils/ScopeUtils";
import TVisibility from "../../../../transpiler/types/TVisibility";
import ParserUtils from "../../../../utils/ParserUtils";
import MemberSymbolBase from "../utils/MemberSymbolBase";

class BitmapCollector {
  /**
   * Collect a bitmap declaration and return an IBitmapSymbol.
   *
   * @param ctx The bitmap declaration context
   * @param sourceFile Source file path
   * @param scopePath The path of the scope this bitmap belongs to (dotted path, "" at file scope)
   * @param visibility ADR-016 visibility as declared (#1300)
   * @returns The bitmap symbol with proper scope reference
   * @throws Error if total bits don't match bitmap size
   */
  static collect(
    ctx: Parser.BitmapDeclarationContext,
    sourceFile: string,
    scopePath: string,
    visibility: TVisibility,
  ): IBitmapSymbol {
    const name = ctx.IDENTIFIER().getText();
    const bitmapType = ctx.bitmapType().getText();
    const expectedBits = BITMAP_SIZE[bitmapType];
    const backingType = BITMAP_BACKING_TYPE[bitmapType];
    const span = ParserUtils.getSpan(ctx);

    // Collect fields with running bit offset
    const fields = new Map<string, IBitmapFieldSymbol>();
    // #1318: a field hangs off the BITMAP, so its identity is the bitmap's
    // source-spelled name plus its own -- an index key, never emitted C.
    const identity = ScopeUtils.identityOf({ name, scopePath });
    const ownerScopedName = identity.cnxScopedName;
    let totalBits = 0;

    for (const member of ctx.bitmapMember()) {
      const fieldName = member.IDENTIFIER().getText();
      const widthLiteral = member.INTEGER_LITERAL();
      const width = widthLiteral
        ? Number.parseInt(widthLiteral.getText(), 10)
        : 1;

      fields.set(fieldName, {
        ...MemberSymbolBase.of({
          kind: "bitmap_field" as const,
          name: fieldName,
          parentScopedName: ownerScopedName,
          memberCtx: member,
          parentSpan: span,
          sourceFile,
          visibility,
        }),
        offset: totalBits,
        width,
      });
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
      scopePath,
      // #1285: identity computed once, from the scope chain, not
      // re-derived by every consumer.
      // #1318 review: the same identity the members were keyed by, not a
      // second call with the same arguments -- change one and the members
      // would keep the old parent name while this reported the new one.
      ...identity,
      sourceFile,
      span,
      sourceLanguage: ESourceLanguage.CNext,
      visibility,
      backingType,
      bitWidth: expectedBits,
      fields,
    };
  }
}

export default BitmapCollector;
