/**
 * Metadata for a bitmap field.
 * Bitmaps define named bit regions within a backing integer type.
 */
interface IBitmapFieldInfo {
  /** Bit offset from LSB */
  readonly bitOffset: number;

  /** Width in bits */
  readonly bitWidth: number;
}

export default IBitmapFieldInfo;
