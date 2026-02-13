import type IBaseSymbol from "./IBaseSymbol";
import type IBitmapFieldInfo from "./IBitmapFieldInfo";

/**
 * Symbol representing a bitmap type definition.
 */
interface IBitmapSymbol extends IBaseSymbol {
  /** Discriminator narrowed to "bitmap" */
  readonly kind: "bitmap";

  /** Backing integer type (e.g., "u8", "u32") */
  readonly backingType: string;

  /** Total bit width of the bitmap */
  readonly bitWidth: number;

  /** Map of field name to bit offset/width metadata */
  readonly fields: ReadonlyMap<string, IBitmapFieldInfo>;
}

export default IBitmapSymbol;
