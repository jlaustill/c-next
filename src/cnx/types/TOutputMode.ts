/**
 * Issue #1143: Which generated output a requirement can appear in.
 *
 * Needed because a probe alone cannot tell the modes apart: C99 and C++20 both
 * spell designated initializers `.field = value`, so the same text means
 * "baseline" in a .c file and "C++20 or a compiler extension" in a .cpp file.
 * Mode is a property of the requirement, not something to infer from the text.
 */
type TOutputMode = "c" | "cpp";

export default TOutputMode;
