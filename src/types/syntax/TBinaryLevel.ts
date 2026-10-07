/**
 * Which of the grammar's ten left-associative binary levels an operator
 * chain was written at, from `||` down to `*` (#1932).
 *
 * Kept rather than inferred from the operators: MISRA's composite rules
 * (#1668) and ADR-044's saturation work on a whole level, `a + b - c` being
 * ONE additive level of three operands, not two nested binaries.
 */
type TBinaryLevel =
  | "or"
  | "and"
  | "equality"
  | "relational"
  | "bitwiseOr"
  | "bitwiseXor"
  | "bitwiseAnd"
  | "shift"
  | "additive"
  | "multiplicative";

export default TBinaryLevel;
