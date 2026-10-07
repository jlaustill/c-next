/**
 * One way `src/` departs from the pass table (#1443).
 *
 * - `missing`: README §1's tree names it and `src/` does not have it.
 * - `unexpected`: `src/` has it and the tree does not name it.
 * - `order`: a module reaches a later pass (a `*-reads-no-later-pass` rule).
 * - `place`: the tree and `PASS_ORDER` disagree -- an entry inside a layer that
 *   no place (or more than one) covers, a place that covers nothing drawn, or
 *   passes listed out of the tree's order.
 */
interface ILayoutFailure {
  readonly kind: "missing" | "unexpected" | "order" | "place";
  /** `src/`-relative entry, `from -> to` for `order`, a pattern or entry for `place`. */
  readonly detail: string;
}

export default ILayoutFailure;
