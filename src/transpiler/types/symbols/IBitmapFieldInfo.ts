/**
 * Metadata for a bitmap field.
 * Bitmaps define named bit regions within a backing integer type.
 */
interface IBitmapFieldInfo {
  /** Bit offset from LSB */
  readonly offset: number;

  /** Width in bits */
  readonly width: number;
}

export default IBitmapFieldInfo;
