/**
 * A name's compile-time integer value where it is used, with the declared
 * type that holds it (#1664 review of #1668's C11).
 *
 * The type is what lets a fold refuse a result C would not compute: `A - 3`
 * on a `u8` is ADR-044's saturating `cnx_clamp_sub_u8(A, 3U)` in C, which is
 * 0, and a fold that knew only the value said -1.
 */
interface IFoldedConstant {
  readonly value: number;
  /** The declaration's C-Next type name (`u8`), or null when it has none */
  readonly typeName: string | null;
}

export default IFoldedConstant;
