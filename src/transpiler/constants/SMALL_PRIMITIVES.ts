/**
 * Primitive types small enough to pass by value (ADR-006).
 *
 * A shared runtime lookup rather than a constant inside the analyzer, for a
 * layering reason: #1511 makes pass-by-value eligibility a fact 1.4 Resolve
 * authors, and `PARSE/` may not import `TRANSPILE/`, so the list cannot stay
 * where the analyzer had it.
 */
const SMALL_PRIMITIVES: ReadonlySet<string> = new Set([
  "u8",
  "i8",
  "u16",
  "i16",
  "u32",
  "i32",
  "u64",
  "i64",
  "bool",
]);

export default SMALL_PRIMITIVES;
