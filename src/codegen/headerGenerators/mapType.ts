/**
 * C-Next to C Type Mapping Utility
 *
 * Provides shared type mapping functionality for both header
 * and implementation code generation.
 *
 * Source of truth: src/constants/TypeMappings.ts
 */

import CNEXT_TO_C_TYPE_MAP from "../../constants/TypeMappings";

/**
 * Map a C-Next type to C type
 *
 * Handles:
 * - Direct primitive type mappings (u32 -> uint32_t)
 * - Pointer types (u32* -> uint32_t*)
 * - Array types (u32[10] -> uint32_t[10])
 * - String types (string<N> -> char[N+1])
 * - User-defined types (pass through unchanged)
 *
 * @param type - The C-Next type string
 * @returns The corresponding C type string
 */
function mapType(type: string): string {
  // Check direct mapping first
  if (CNEXT_TO_C_TYPE_MAP[type]) {
    return CNEXT_TO_C_TYPE_MAP[type];
  }

  // Issue #427: Handle string<N> types -> char[N+1]
  const stringMatch = /^string<(\d+)>$/.exec(type);
  if (stringMatch) {
    const capacity = Number.parseInt(stringMatch[1], 10);
    return `char[${capacity + 1}]`;
  }

  // Handle pointer types
  if (type.endsWith("*")) {
    const baseType = type.slice(0, -1).trim();
    return `${mapType(baseType)}*`;
  }

  // Handle array types (simplified)
  const arrayMatch = /^(\w+)\[(\d*)\]$/.exec(type);
  if (arrayMatch) {
    const baseType = mapType(arrayMatch[1]);
    const size = arrayMatch[2] || "";
    return `${baseType}[${size}]`;
  }

  // User-defined types pass through
  return type;
}

/**
 * Check if a type is a built-in C-Next type (primitive or string<N>)
 * Used by header generator to avoid generating forward declarations for built-in types
 */
function isBuiltInType(typeName: string): boolean {
  // Direct primitive types
  if (CNEXT_TO_C_TYPE_MAP[typeName]) {
    return true;
  }

  // Issue #427: string<N> is a built-in type
  if (/^string<\d+>$/.test(typeName)) {
    return true;
  }

  return false;
}

export default { TYPE_MAP: CNEXT_TO_C_TYPE_MAP, mapType, isBuiltInType };
