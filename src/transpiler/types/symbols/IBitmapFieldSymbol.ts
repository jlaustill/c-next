import type IBaseSymbol from "./IBaseSymbol";

/**
 * Symbol representing one named bit region of a bitmap.
 *
 * Was `IBitmapFieldInfo`, which carried an offset and a width and not even a
 * name -- the name lived only as the enclosing Map's key, so a field handed to
 * a helper arrived anonymous (#1318).
 *
 * `fullyQualifiedCName` is an INDEX KEY, not an emitted identifier: a bitmap
 * field becomes shift-and-mask arithmetic, never a C identifier of its own.
 */
interface IBitmapFieldSymbol extends IBaseSymbol {
  /** Discriminator narrowed to "bitmap_field" */
  readonly kind: "bitmap_field";

  /** Bit offset from LSB */
  readonly offset: number;

  /** Width in bits */
  readonly width: number;
}

export default IBitmapFieldSymbol;
