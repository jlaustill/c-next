/**
 * C-Next to C Type Mappings
 *
 * Single source of truth for type mappings used across:
 * - CodeGenerator (src/codegen/types/TYPE_MAP.ts)
 * - TypeUtils (src/symbol_resolution/cnext/utils/TypeUtils.ts)
 * - Header Generator (src/codegen/headerGenerators/mapType.ts)
 */

/**
 * Maps C-Next primitive types to their C equivalents.
 *
 * Used by:
 * - Code generation for variable/parameter declarations
 * - Header generation for extern declarations
 * - Symbol resolution for type conversion
 */
const CNEXT_TO_C_TYPE_MAP: Record<string, string> = {
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

export default CNEXT_TO_C_TYPE_MAP;
