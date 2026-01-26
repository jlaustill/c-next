/**
 * Header include types that can be required by generators.
 *
 * - stdint: Standard integer types (uint8_t, etc.)
 * - stdbool: Boolean type (bool)
 * - string: String functions (strlen, strncpy, etc.)
 * - cmsis: CMSIS intrinsics (for atomic operations)
 * - irq_wrappers: IRQ wrapper functions for critical sections (avoids macro collisions)
 */
type TIncludeHeader =
  | "stdint"
  | "stdbool"
  | "string"
  | "cmsis"
  | "irq_wrappers";

export default TIncludeHeader;
