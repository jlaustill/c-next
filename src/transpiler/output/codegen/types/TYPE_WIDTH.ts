/**
 * Maps primitive types to their bit widths
 */
const TYPE_WIDTH: Record<string, number> = {
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
  bool: 8, // Storage size is 1 byte (8 bits), not 1 bit
};

export default TYPE_WIDTH;
