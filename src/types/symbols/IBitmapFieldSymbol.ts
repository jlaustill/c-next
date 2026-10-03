import type IBitmapFieldLayout from "../IBitmapFieldLayout";
import type IBaseSymbol from "./IBaseSymbol";

/**
 * Symbol representing one named bit region of a bitmap.
 *
 * Was `IBitmapFieldInfo`, which carried an offset and a width and not even a
 * name -- the name lived only as the enclosing Map's key, so a field handed to
 * a helper arrived anonymous (#1318).
 *
 * The bit region itself comes from `IBitmapFieldLayout` rather than being
 * restated. It used to be restated, and #1486's gate allow-listed the
 * restatement as "the symbol, not the projection" -- but #1318 decided which
 * TYPE the consumers receive, not that the two declarations of the same two
 * fields must be maintained in parallel. They were: adding a third bit-region
 * property meant editing this file and `IBitmapFieldLayout` in lockstep, which
 * is the defect #1486 was filed to end, surviving inside the check written to
 * end it. Composing states the relationship the projection already assumes and
 * widens nothing -- structural typing made this type assignable to the layout
 * either way; `extends` is what makes the compiler enforce it.
 *
 * `fullyQualifiedCName` is an INDEX KEY, not an emitted identifier: a bitmap
 * field becomes shift-and-mask arithmetic, never a C identifier of its own.
 */
interface IBitmapFieldSymbol extends IBaseSymbol, IBitmapFieldLayout {
  /** Discriminator narrowed to "bitmap_field" */
  readonly kind: "bitmap_field";
}

export default IBitmapFieldSymbol;
