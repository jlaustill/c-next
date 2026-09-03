import type IBaseSymbol from "./IBaseSymbol";
import type IBitmapFieldSymbol from "./IBitmapFieldSymbol";

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
  /**
   * Fields, each a symbol carrying its own span and identity (#1318).
   * Keyed by bare field name, which is how every consumer looks one up.
   */
  readonly fields: ReadonlyMap<string, IBitmapFieldSymbol>;
}

export default IBitmapSymbol;
