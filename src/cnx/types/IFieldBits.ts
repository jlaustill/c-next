import type IOperandType from "./IOperandType";

/**
 * ADR-034 (#2251): a bit or bit range of a bitmap field is bits of the
 * bitmap. `p.Mode[1]`, with `Mode` at bits 4-6, is bit 5 of `p`: the
 * bitmap value it is a field of, and the field's offset in it.
 */
interface IFieldBits {
  /** The bitmap value the field is read off */
  readonly storage: IOperandType | null;
  /** The field's offset in the bitmap's backing value */
  readonly offset: number;
}

export default IFieldBits;
