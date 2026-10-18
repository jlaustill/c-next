import type IChainStep from "../../types/IChainStep";
import type IBitmapFieldLayout from "../../types/IBitmapFieldLayout";
import BitmapFieldStep from "../../utils/BitmapFieldStep";
import ForHeaderAssignment from "../../utils/ForHeaderAssignment";
import TYPE_MAP from "./types/TYPE_MAP";

const UNSIGNED = ["u8", "u16", "u32", "u64"];

/**
 * ADR-049 (#2200): a bit, a bit range or a bitmap field written to an `atomic`
 * value is a read-modify-write of that value, made atomic as a compound write
 * to it is. The one decision of which writes those are, and of the integer
 * the value is accessed as: a bitmap is its backing integer.
 */
class AtomicBitOwner {
  /**
   * The C-Next integer type an atomic value whose bits the step writes is
   * accessed as, or null when the step writes no bits of an atomic value
   */
  static typeName(
    step: IChainStep | undefined,
    bitmapFields: ReadonlyMap<string, ReadonlyMap<string, IBitmapFieldLayout>>,
    bitmapBackingType: ReadonlyMap<string, string>,
  ): string | null {
    const writesBits =
      step?.subscript === "bit_single" ||
      step?.subscript === "bit_range" ||
      BitmapFieldStep.fieldOf(step, bitmapFields) !== null;
    const owner = step?.before ?? null;
    if (!writesBits || !ForHeaderAssignment.isAtomic(owner)) return null;
    const bitmap = owner?.bitmapTypeName ?? null;
    if (bitmap === null) return owner?.typeName ?? null;
    const backing = bitmapBackingType.get(bitmap);
    return UNSIGNED.find((name) => TYPE_MAP[name] === backing) ?? null;
  }
}

export default AtomicBitOwner;
