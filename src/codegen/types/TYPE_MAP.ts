/**
 * Maps C-Next types to C types
 */
const TYPE_MAP: Record<string, string> = {
  u8: "uint8_t",
  u16: "uint16_t",
  u32: "uint32_t",
  u64: "uint64_t",
  i8: "int8_t",
  i16: "int16_t",
  i32: "int32_t",
  i64: "int64_t",
  f32: "float",
  f64: "double",
  bool: "bool",
  void: "void",
  ISR: "ISR", // ADR-040: Interrupt Service Routine function pointer
  cstring: "char*", // ADR-046: C string pointer type (nullable)
};

export default TYPE_MAP;
