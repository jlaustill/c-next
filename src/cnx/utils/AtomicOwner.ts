import type IChainStep from "../types/IChainStep";
import type IBitmapFieldTarget from "../types/IBitmapFieldTarget";
import type IOperandType from "../types/IOperandType";
import type IAssignmentSyntax from "../types/syntax/IAssignmentSyntax";
import type IAtomicAccess from "../types/IAtomicAccess";
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
 * The answer is what the value is accessed as (`IAtomicAccess`); null means
 * only that the value is not declared `atomic`. 2.2 plans the write's form
 * from it, and ADR-068's E0715 rejects it in a `for` header, so neither
 * decides it again (#2155 review).
 */
class AtomicOwner {
  static ofWrite(
    site: IAssignmentSyntax,
    context: ITypingContext,
    bitmapField: IBitmapFieldTarget | null,
  ): IAtomicAccess | null {
    if (site.operator === "<-") {
      return AtomicOwner.ofBits(
        OperandTyper.chainOf(site.target, context).steps.at(-1),
        bitmapField,
        context.symbols.bitmapBackingType,
      );
    }
    const written = OperandTyper.typeOfTarget(site.target, context);
    if (written === null || !AtomicOwner.isDeclaredAtomic(written)) {
      return null;
    }
    return AtomicOwner.accessOf(written, context.symbols.bitmapBackingType);
  }

  /** The atomic value whose bits `step` -- or the bitmap field 2.2 planned it to write -- writes, or null */
  static ofBits(
    step: IChainStep | undefined,
    bitmapField: IBitmapFieldTarget | null,
    bitmapBackingType: ReadonlyMap<string, string>,
  ): IAtomicAccess | null {
    const owner = step?.before ?? null;
    if (
      owner === null ||
      !BitmapFieldStep.writesBits(step, bitmapField) ||
      !AtomicOwner.isDeclaredAtomic(owner)
    ) {
      return null;
    }
    return AtomicOwner.accessOf(owner, bitmapBackingType);
  }

  /**
   * What an atomic value of type `t` is accessed as: a bitmap as its backing
   * integer, a C-Next type as itself, a C header type by its C type alone
   */
  private static accessOf(
    t: IOperandType,
    bitmapBackingType: ReadonlyMap<string, string>,
  ): IAtomicAccess {
    const bitmap = t.bitmapTypeName;
    if (bitmap !== null) {
      const backing = bitmapBackingType.get(bitmap);
      const accessed = UNSIGNED.find(
        (name) => CNEXT_TO_C_TYPE_MAP[name] === backing,
      );
      invariant(
        accessed !== undefined && backing !== undefined,
        `a bitmap's backing type is an unsigned integer ('${backing}')`,
      );
      return { typeName: accessed, cType: backing };
    }
    const named =
      t.typeName === null ? undefined : CNEXT_TO_C_TYPE_MAP[t.typeName];
    if (t.typeName !== null && named !== undefined) {
      return { typeName: t.typeName, cType: named };
    }
    invariant(
      t.cType !== null,
      `an atomic value has a C type to be accessed as ('${t.typeName}')`,
    );
    return { typeName: null, cType: t.cType };
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
