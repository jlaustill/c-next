/**
 * Maps C-Next types to C limit macros from limits.h
 */

/**
 * Maps C-Next types to C max value macros
 */
const TYPE_MAX: Record<string, string> = {
  u8: "UINT8_MAX",
  u16: "UINT16_MAX",
  u32: "UINT32_MAX",
  u64: "UINT64_MAX",
  i8: "INT8_MAX",
  i16: "INT16_MAX",
  i32: "INT32_MAX",
  i64: "INT64_MAX",
};

/**
 * Maps C-Next types to C min value macros
 */
const TYPE_MIN: Record<string, string> = {
  u8: "0",
  u16: "0",
  u32: "0",
  u64: "0",
  i8: "INT8_MIN",
  i16: "INT16_MIN",
  i32: "INT32_MIN",
  i64: "INT64_MIN",
};

const TYPE_LIMITS = {
  TYPE_MAX,
  TYPE_MIN,
};

export default TYPE_LIMITS;
