/**
 * C-Next to C Type Mapping Utility
 *
 * Provides shared type mapping functionality for both header
 * and implementation code generation.
 */

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
};

/**
 * Map a C-Next type to C type
 *
 * Handles:
 * - Direct primitive type mappings (u32 -> uint32_t)
 * - Pointer types (u32* -> uint32_t*)
 * - Array types (u32[10] -> uint32_t[10])
 * - User-defined types (pass through unchanged)
 *
 * @param type - The C-Next type string
 * @returns The corresponding C type string
 */
function mapType(type: string): string {
  // Check direct mapping first
  if (TYPE_MAP[type]) {
    return TYPE_MAP[type];
  }

  // Handle pointer types
  if (type.endsWith("*")) {
    const baseType = type.slice(0, -1).trim();
    return `${mapType(baseType)}*`;
  }

  // Handle array types (simplified)
  const arrayMatch = type.match(/^(\w+)\[(\d*)\]$/);
  if (arrayMatch) {
    const baseType = mapType(arrayMatch[1]);
    const size = arrayMatch[2] || "";
    return `${baseType}[${size}]`;
  }

  // User-defined types pass through
  return type;
}

export default { TYPE_MAP, mapType };
