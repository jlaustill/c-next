/**
 * Type names that are spelled as a bare identifier but are built into the
 * language, so they reach `userType` in the grammar without ever being
 * declared.
 *
 * - `ISR`     — ADR-009, lowered to `typedef void (*ISR)(void)`
 * - `cstring` — ADR-046, lowered to `char*` for C library interop
 *
 * These must not be reported as undefined types (E0426) or undefined values
 * (E0427): they are defined by the language, just not by the program.
 */
const BUILTIN_TYPE_NAMES: ReadonlySet<string> = new Set(["ISR", "cstring"]);

export default BUILTIN_TYPE_NAMES;
