/**
 * ADR-049 (#1789): how a compare-exchange retry loop declares `__old` and
 * `__new` and reaches them -- the member the builtins exchange, and the one
 * the new value is computed into. A value of its own C type uses neither; an
 * atomic float's bits go through a union's float and integer views.
 */
interface ICompareExchangeViews {
  /** The declaration of `name`, at the loop's indentation */
  readonly declare: (name: string) => string;
  /** The member `__atomic_load`/`__atomic_compare_exchange` take the address of */
  readonly exchanged: string;
  /** The member the new value is assigned to */
  readonly computed: string;
}

export default ICompareExchangeViews;
