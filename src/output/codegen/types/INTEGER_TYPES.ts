/**
 * ADR-024: Type classification for safe casting
 */
const UNSIGNED_TYPES = ["u8", "u16", "u32", "u64"] as const;
const SIGNED_TYPES = ["i8", "i16", "i32", "i64"] as const;
const INTEGER_TYPES = [...UNSIGNED_TYPES, ...SIGNED_TYPES] as const;

export default INTEGER_TYPES;
