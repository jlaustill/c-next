import type IChainStep from "../types/IChainStep";
import type IBitmapFieldTarget from "../types/IBitmapFieldTarget";
import type IOperandType from "../types/IOperandType";
import type IAssignmentSyntax from "../types/syntax/IAssignmentSyntax";
import type ITypingContext from "../types/ITypingContext";
import BitmapFieldStep from "./BitmapFieldStep";
import CNEXT_TO_C_TYPE_MAP from "./constants/TypeMappings";
import OperandTyper from "./OperandTyper";
import invariant from "./invariant";

const UNSIGNED = ["u8", "u16", "u32", "u64"];

/**
 * ADR-049: the one answer to "which `atomic` value does this write
 * read-modify-write", from the typer's chain, whatever spells the target
 * (#1179, #2200). A compound write modifies its target; a bit, a bit range or
 * a bitmap field written with `<-` modifies the value before that step.
 * The answer is the value's C-Next type: a bitmap's is its backing integer.
 * 2.2 plans the write's form from it, and ADR-068's E0715 rejects it in a
 * `for` header, so neither decides it again (#2155 review).
 */
class AtomicOwner {
  static ofWrite(
    site: IAssignmentSyntax,
    context: ITypingContext,
    bitmapField: IBitmapFieldTarget | null,
  ): string | null {
    if (site.operator === "<-") {
      return AtomicOwner.ofBits(
        OperandTyper.chainOf(site.target, context).steps.at(-1),
        bitmapField,
        context.symbols.bitmapBackingType,
      );
    }
    const written = OperandTyper.typeOfTarget(site.target, context);
    return AtomicOwner.isDeclaredAtomic(written)
      ? (written?.typeName ?? null)
      : null;
  }

  /** The atomic value whose bits `step` -- or the bitmap field 2.2 planned it to write -- writes, or null */
  static ofBits(
    step: IChainStep | undefined,
    bitmapField: IBitmapFieldTarget | null,
    bitmapBackingType: ReadonlyMap<string, string>,
  ): string | null {
    const owner = step?.before ?? null;
    if (
      !BitmapFieldStep.writesBits(step, bitmapField) ||
      !AtomicOwner.isDeclaredAtomic(owner)
    ) {
      return null;
    }
    const bitmap = owner?.bitmapTypeName ?? null;
    if (bitmap === null) return owner?.typeName ?? null;
    const backing = bitmapBackingType.get(bitmap);
    const accessed = UNSIGNED.find(
      (name) => CNEXT_TO_C_TYPE_MAP[name] === backing,
    );
    invariant(
      accessed,
      `a bitmap's backing type is an unsigned integer ('${backing}')`,
    );
    return accessed;
  }

  /** Declared `atomic`, by the declaration the value binds to */
  static isDeclaredAtomic(t: IOperandType | null): boolean {
    const binding = t?.binding;
    if (binding?.kind === "local") return binding.declaration.isAtomic;
    if (binding?.kind === "variable") return binding.symbol.isAtomic;
    return false;
  }
}

export default AtomicOwner;
