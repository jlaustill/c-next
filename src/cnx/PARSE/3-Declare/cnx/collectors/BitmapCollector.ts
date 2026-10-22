/**
 * BitmapCollector - Extracts bitmap type declarations from parse trees.
 * ADR-034: Bitmaps provide named access to bit regions within an integer backing type.
 *
 * Produces TType-based IBitmapSymbol with proper IScopeSymbol references.
 */

import type TDeclarationSyntax from "../../../../types/syntax/TDeclarationSyntax";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import IBitmapSymbol from "../../../../types/symbols/IBitmapSymbol";
import type IBitmapFieldSymbol from "../../../../types/symbols/IBitmapFieldSymbol";
import BITMAP_SIZE from "./BITMAP_SIZE";
import BITMAP_BACKING_TYPE from "./BITMAP_BACKING_TYPE";
import ScopeUtils from "../../../../utils/ScopeUtils";
import TVisibility from "../../../../types/TVisibility";
import MemberSymbolBase from "../utils/MemberSymbolBase";

class BitmapCollector {
  /**
   * Collect a bitmap declaration and return an IBitmapSymbol.
   *
   * @param syntax The bitmap declaration as 1.2 lowered it (#1991)
   * @param sourceFile Source file path
   * @param scopePath The path of the scope this bitmap belongs to (dotted path, "" at file scope)
   * @param visibility ADR-016 visibility as declared (#1300)
   * @returns The bitmap symbol with proper scope reference. Fields that do not
   *          fill its width are recorded as written: whether they must is
   *          ADR-034's rule, and 2.1 Analyze reports it as E0893 (#1531).
   */
  static collect(
    syntax: Extract<TDeclarationSyntax, { kind: "bitmap" }>,
    sourceFile: string,
    scopePath: string,
    visibility: TVisibility,
  ): IBitmapSymbol {
    const name = syntax.name;
    const bitmapType = syntax.bitmapType;
    const expectedBits = BITMAP_SIZE[bitmapType];
    const backingType = BITMAP_BACKING_TYPE[bitmapType];
    const span = syntax.span;

    // Collect fields with running bit offset
    const fields = new Map<string, IBitmapFieldSymbol>();
    // #1318: a field hangs off the BITMAP, so its identity is the bitmap's
    // source-spelled name plus its own -- an index key, never emitted C.
    const identity = ScopeUtils.identityOf({ name, scopePath });
    const ownerScopedName = identity.cnxScopedName;
    let totalBits = 0;

    for (const member of syntax.members) {
      const fieldName = member.name;
      const width =
        member.width === null ? 1 : Number.parseInt(member.width, 10);

      fields.set(fieldName, {
        ...MemberSymbolBase.of({
          kind: "bitmap_field" as const,
          name: fieldName,
          parentScopedName: ownerScopedName,
          memberSpan: member.span,
          sourceFile,
          visibility,
        }),
        offset: totalBits,
        width,
      });
      totalBits += width;
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
      sourceLanguage: ESourceLanguage.Cnx,
      visibility,
      backingType,
      bitWidth: expectedBits,
      fields,
    };
  }
}

export default BitmapCollector;
