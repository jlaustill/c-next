import type TAtomicForm from "./TAtomicForm";

/**
 * ADR-049: 2.2's decision for one atomic read-modify-write -- its form, and
 * the C-Next integer the atomic value is accessed as, which picks the
 * exclusive-access intrinsic and the retry loop's types (#1179, #2200)
 */
interface IPlannedAtomic {
  readonly form: TAtomicForm;
  readonly typeName: string;
  /**
   * The C type a retry loop holds a bit, bit-range or bitmap-field write's
   * value in (`__operand`); null for a compound write
   */
  readonly operandCType: string | null;
}

export default IPlannedAtomic;
