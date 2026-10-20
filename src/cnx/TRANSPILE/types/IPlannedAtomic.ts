import type IAtomicAccess from "../../types/IAtomicAccess";
import type TAtomicForm from "./TAtomicForm";
import type IExclusiveAccess from "./IExclusiveAccess";

/**
 * ADR-049: 2.2's decision for one atomic read-modify-write -- its form, what
 * the atomic value is accessed as, which picks the exclusive-access intrinsic
 * and the retry loop's types (#1179, #2200), and the C type a retry loop
 * holds the written value in (`__operand`)
 */
interface IPlannedAtomic extends IAtomicAccess {
  readonly form: TAtomicForm;
  readonly operandCType: string;
  /** The exclusive access an `ldrex-strex` form makes; null for any other form */
  readonly exclusive: IExclusiveAccess | null;
}

export default IPlannedAtomic;
