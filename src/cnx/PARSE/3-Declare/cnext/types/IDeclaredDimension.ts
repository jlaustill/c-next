import type TConstExpr from "../../../../types/TConstExpr";

/**
 * One array dimension as 1.3 Declare records it (#1175): the size, when 1.3
 * can know it alone, and the dimension as written, when it cannot.
 */
interface IDeclaredDimension {
  /**
   * The folded size; `""` for an unsized `[]`; UNRESOLVED_DIMENSION when the
   * size needs a name 1.3 cannot bind (a const, an enum member, a macro)
   */
  readonly size: number | string;
  /** The dimension as written, for 1.4 to settle; null when `size` is final */
  readonly expr: TConstExpr | null;
}

export default IDeclaredDimension;
