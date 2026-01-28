/**
 * Maps C-Next types to C types
 *
 * Re-exports shared type mapping for backwards compatibility.
 * Source of truth: src/constants/TypeMappings.ts
 */
import CNEXT_TO_C_TYPE_MAP from "../../constants/TypeMappings";

const TYPE_MAP: Record<string, string> = CNEXT_TO_C_TYPE_MAP;

export default TYPE_MAP;
