/**
 * DeclaredTypeFacts -- what a declared type NAME tells you about a variable.
 *
 * ## Why this exists (#1651)
 *
 * Four sites independently answered "is this name an enum or a bitmap, and how
 * wide is it": the declaration path, the bitmap-array path, the parameter path
 * and the cross-file symbol converter. All four read the same two sets, so the
 * DETECTION was already shared -- and CLAUDE.md is explicit that this is not
 * enough, because each then derived the CONSEQUENCES for itself.
 *
 * They diverged twice before anyone looked, in the same direction both times:
 * the cross-file converter is the one that forgets a field.
 *
 * - #1303 -- it dropped `overflowBehavior`, so an imported `u8` wrapped where
 *   the declared ADR-044 behavior said saturate.
 * - #1651 -- it dropped `isBitmap`/`bitmapTypeName`, so `shared.Active <- 1`
 *   one include hop from the declaration classified as a struct member write
 *   and emitted `shared.Active = 1`: a member access on a scalar, which gcc
 *   rejects outright. The same statement same-file lowered to mask-and-shift.
 *
 * It had also diverged a third time without being noticed, on the width: the
 * converter computed `TYPE_WIDTH[name]`, which has no entry for a bitmap type,
 * so every cross-file bitmap registered `bitWidth: 0` against the real 8/16/
 * 32/64 the other three record. Reads survive that because
 * `getNumericBitWidth` re-derives the width from the name when the registered
 * one is 0 -- a compensation in a fourth module for a fact the registry was
 * supposed to carry. Byte-count consumers have no such fallback.
 *
 * So the quintuple is derived ONCE, here, and the callers keep only what
 * genuinely differs between them: the width of a name that is neither an enum
 * nor a bitmap, which is a string capacity in one caller and a primitive width
 * in the others.
 */
import type IDeclaredTypeFacts from "../transpiler/types/IDeclaredTypeFacts";
import type IDeclaredTypeSets from "../transpiler/types/IDeclaredTypeSets";

class DeclaredTypeFacts {
  /**
   * Classify a base type name against the declared enum and bitmap sets.
   *
   * `fallbackBitWidth` is used only when the name is neither -- callers answer
   * that differently and correctly: a string variable is 8 (its element), a
   * parameter is its primitive width, an enum registers 0 and is widened to
   * ADR-017's 32 bits at the point of use rather than here.
   */
  static of(
    baseType: string,
    sets: IDeclaredTypeSets | null,
    fallbackBitWidth: number,
  ): IDeclaredTypeFacts {
    // An absent symbol view means "nothing is known yet", never "not an enum"
    // -- the reading `isKnownEnum`/`isKnownBitmap` already encode with `?? false`.
    const isEnum = sets?.knownEnums.has(baseType) ?? false;
    const isBitmap = sets?.knownBitmaps.has(baseType) ?? false;

    return {
      isEnum,
      enumTypeName: isEnum ? baseType : undefined,
      isBitmap,
      bitmapTypeName: isBitmap ? baseType : undefined,
      bitWidth: isBitmap
        ? (sets?.bitmapBitWidth.get(baseType) ?? 0)
        : fallbackBitWidth,
    };
  }
}

export default DeclaredTypeFacts;
