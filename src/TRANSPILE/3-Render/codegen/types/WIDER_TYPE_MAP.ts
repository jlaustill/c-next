/**
 * Maps C-Next types to wider C types for clamp helper operands
 * Issue #94: Prevents silent truncation when operand exceeds target type range
 */
const WIDER_TYPE_MAP: Record<string, string> = {
  u8: "uint32_t",
  u16: "uint32_t",
  u32: "uint64_t",
  u64: "uint64_t", // Already widest
  i8: "int32_t",
  i16: "int32_t",
  i32: "int64_t",
  i64: "int64_t", // Already widest
};

export default WIDER_TYPE_MAP;
