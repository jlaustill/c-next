import type IBitmapFieldLayout from "./IBitmapFieldLayout";

/** ADR-034: the bitmap field an assignment target's final step names */
interface IBitmapFieldTarget {
  /** The bitmap the field belongs to */
  readonly bitmapType: string;
  readonly fieldName: string;
  /** The field's offset and width in the bitmap's backing value */
  readonly layout: IBitmapFieldLayout;
}

export default IBitmapFieldTarget;
