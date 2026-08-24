/**
 * The binary-operator levels of the C-Next expression grammar, in precedence
 * order from tightest to loosest.
 *
 * An analyzer that inspects operand pairs selects the levels its rule governs:
 * MISRA Rule 10.4 skips `shift` (a shift count is promoted independently, so
 * the usual arithmetic conversions do not apply), and MISRA Rule 10.1's
 * Boolean-operand check skips `equality` (comparing two bools is permitted).
 */
type TBinaryOperatorLevel =
  | "multiplicative"
  | "additive"
  | "shift"
  | "bitwiseAnd"
  | "bitwiseXor"
  | "bitwiseOr"
  | "relational"
  | "equality";

export default TBinaryOperatorLevel;
