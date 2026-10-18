import type IChainStep from "../types/IChainStep";

/**
 * ADR-034: whether an assignment target's final step is a field of a bitmap
 * -- a `.field` read off a bitmap value, or off a register member a bitmap
 * types -- as the one operand typer typed the chain. The one answer for every
 * rule that asks: the classifier routing the write, and E0857 rejecting a
 * compound operator on it (#2159), so the two cannot disagree about which
 * targets are fields.
 */
class BitmapFieldStep {
  /** The bitmap a final `.field` step reads its field from, or null */
  static bitmapOf(
    step: IChainStep | undefined,
    lastOpIsMember: boolean,
  ): string | null {
    if (!lastOpIsMember || step === undefined || step.property !== null) {
      return null;
    }
    const bitmapType = step.before?.bitmapTypeName;
    if (!bitmapType || step.before!.dimensions.length !== 0) {
      return null;
    }
    return bitmapType;
  }
}

export default BitmapFieldStep;
