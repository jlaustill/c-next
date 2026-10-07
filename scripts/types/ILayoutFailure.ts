/**
 * One way `src/` departs from the pass table (#1443).
 *
 * - `missing`: README §1's tree names it and `src/` does not have it.
 * - `unexpected`: `src/` has it and the tree does not name it.
 * - `order`: a module reaches a later pass (a `*-reads-no-later-pass` rule).
 */
interface ILayoutFailure {
  readonly kind: "missing" | "unexpected" | "order";
  /** `src/`-relative entry, or `from -> to` for an `order` failure. */
  readonly detail: string;
}

export default ILayoutFailure;
