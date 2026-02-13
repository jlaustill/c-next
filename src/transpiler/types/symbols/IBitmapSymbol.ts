import type IBaseSymbol from "./IBaseSymbol";
import type IBitmapFieldInfo from "./IBitmapFieldInfo";

/**
 * Symbol representing a bitmap type definition.
 */
interface IBitmapSymbol extends IBaseSymbol {
  /** Discriminator narrowed to "bitmap" */
  readonly kind: "bitmap";

  /** Total bit width of the bitmap */
  readonly bitWidth: number;

  /** Map of field name to bit offset/width metadata */
  readonly fields: ReadonlyMap<string, IBitmapFieldInfo>;
}

export default IBitmapSymbol;
