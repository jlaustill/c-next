/**
 * Type classification and validation constants
 * Extracted from CodeGenerator for reuse
 */

/**
 * Maps primitive types to their bit widths
 */
export const TYPE_WIDTH: Record<string, number> = {
  u8: 8,
  i8: 8,
  u16: 16,
  i16: 16,
  u32: 32,
  i32: 32,
  u64: 64,
  i64: 64,
  f32: 32,
  f64: 64,
  bool: 1,
};

/**
 * ADR-034: Bitmap type sizes (total bits)
 */
export const BITMAP_SIZE: Record<string, number> = {
  bitmap8: 8,
  bitmap16: 16,
  bitmap24: 24,
  bitmap32: 32,
};

/**
 * ADR-034: Bitmap backing types for C output
 */
export const BITMAP_BACKING_TYPE: Record<string, string> = {
  bitmap8: "uint8_t",
  bitmap16: "uint16_t",
  bitmap24: "uint32_t", // 24-bit uses 32-bit backing for simplicity
  bitmap32: "uint32_t",
};

/**
 * ADR-024: Type classification for safe casting
 */
export const UNSIGNED_TYPES = ["u8", "u16", "u32", "u64"] as const;
export const SIGNED_TYPES = ["i8", "i16", "i32", "i64"] as const;
export const INTEGER_TYPES = [...UNSIGNED_TYPES, ...SIGNED_TYPES] as const;
export const FLOAT_TYPES = ["f32", "f64"] as const;

/**
 * ADR-024: Type ranges for literal validation
 * Maps type name to [min, max] inclusive range
 */
export const TYPE_RANGES: Record<string, [bigint, bigint]> = {
  u8: [0n, 255n],
  u16: [0n, 65535n],
  u32: [0n, 4294967295n],
  u64: [0n, 18446744073709551615n],
  i8: [-128n, 127n],
  i16: [-32768n, 32767n],
  i32: [-2147483648n, 2147483647n],
  i64: [-9223372036854775808n, 9223372036854775807n],
};
