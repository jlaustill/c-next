/**
 * ADR-049: how 2.2 decided an atomic read-modify-write is written -- an
 * LDREX/STREX retry loop, or the ADR-050 interrupt-masked region.
 */
type TAtomicForm = "ldrex-strex" | "interrupt-mask" | "compare-exchange";

export default TAtomicForm;
