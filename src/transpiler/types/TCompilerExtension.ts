/**
 * Issue #1143: Non-standard compiler features used by emitted output.
 *
 * These are the compiler axis of a requirement: constructs that no version of a
 * strictly-conforming compiler accepts, as opposed to constructs that merely
 * need a newer standard. MISRA C:2012 Rule 1.2 is about exactly this set.
 */
type TCompilerExtension =
  | "GNU inline assembly"
  | "__attribute__((always_inline))"
  | "designated initializers in C++"
  | "compound literals in C++";

export default TCompilerExtension;
