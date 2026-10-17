/**
 * ADR-049: how 2.2 decided an atomic read-modify-write is written -- an
 * LDREX/STREX retry loop, the ADR-050 interrupt-masked region, or a GNU
 * `__atomic` compare-exchange retry loop on a target that cannot mask (#1789).
 */
type TAtomicForm =
  | "ldrex-strex"
  | "interrupt-mask"
  | "compare-exchange"
  /** The same loop on a type wider than the target's word: GCC calls libatomic */
  | "compare-exchange-libatomic";

export default TAtomicForm;
