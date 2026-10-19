import type IChainStep from "../../types/IChainStep";
import type IBitmapFieldTarget from "../../types/IBitmapFieldTarget";
import type IAssignmentSyntax from "../../types/syntax/IAssignmentSyntax";
import type ITypingContext from "../../types/ITypingContext";
import ForHeaderAssignment from "../../utils/ForHeaderAssignment";
import OperandTyper from "../../utils/OperandTyper";
import TYPE_MAP from "./types/TYPE_MAP";

const UNSIGNED = ["u8", "u16", "u32", "u64"];

/**
 * ADR-049: the one answer to "which `atomic` value does this write
 * read-modify-write", from the typer's chain, whatever spells the target
 * (#1179, #2200). A compound write modifies its target; a bit, a bit range or
 * a bitmap field written with `<-` modifies the value before that step.
 * The answer is the value's C-Next type: a bitmap's is its backing integer.
 */
class AtomicOwner {
  static ofWrite(
    site: IAssignmentSyntax,
    context: ITypingContext,
    bitmapField: IBitmapFieldTarget | null,
    bitmapBackingType: ReadonlyMap<string, string>,
  ): string | null {
    if (site.operator === "<-") {
      return AtomicOwner.ofBits(
        OperandTyper.chainOf(site.target, context).steps.at(-1),
        bitmapField,
        bitmapBackingType,
      );
    }
    const written = OperandTyper.typeOfTarget(site.target, context);
    return ForHeaderAssignment.isAtomic(written)
      ? (written?.typeName ?? null)
      : null;
  }

  /** The atomic value whose bits `step` -- or the bitmap field 2.2 planned it to write -- writes, or null */
  static ofBits(
    step: IChainStep | undefined,
    bitmapField: IBitmapFieldTarget | null,
    bitmapBackingType: ReadonlyMap<string, string>,
  ): string | null {
    const writesBits =
      step?.subscript === "bit_single" ||
      step?.subscript === "bit_range" ||
      bitmapField !== null;
    const owner = step?.before ?? null;
    if (!writesBits || !ForHeaderAssignment.isAtomic(owner)) return null;
    const bitmap = owner?.bitmapTypeName ?? null;
    if (bitmap === null) return owner?.typeName ?? null;
    const backing = bitmapBackingType.get(bitmap);
    return UNSIGNED.find((name) => TYPE_MAP[name] === backing) ?? null;
  }
}

export default AtomicOwner;
