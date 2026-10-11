import type TBinaryLevel from "../../../types/syntax/TBinaryLevel";

/**
 * The binary-operator levels of the C-Next expression grammar whose operands
 * pair up (`TBinaryLevel` minus the logical `or` and `and`).
 *
 * An analyzer that inspects operand pairs selects the levels its rule governs:
 * MISRA Rule 10.4 skips `shift` (a shift count is promoted independently, so
 * the usual arithmetic conversions do not apply), and MISRA Rule 10.1's
 * Boolean-operand check skips `equality` (comparing two bools is permitted).
 */
type TBinaryOperatorLevel = Exclude<TBinaryLevel, "or" | "and">;

export default TBinaryOperatorLevel;
