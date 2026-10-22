import COMPOUND_BINARY_OPERATORS from "../../types/syntax/COMPOUND_BINARY_OPERATORS";

/**
 * Operator mapping from cnx assignment operators to C assignment operators:
 * `<-` is C's `=`, and `op<-` is C's `op=` for the binary operator it applies.
 * Used by assignment handling and control flow generation.
 */
const ASSIGNMENT_OPERATOR_MAP: Readonly<Record<string, string>> = {
  "<-": "=",
  ...Object.fromEntries(
    Object.entries(COMPOUND_BINARY_OPERATORS).map(([spelling, operator]) => [
      spelling,
      `${operator}=`,
    ]),
  ),
};

export default ASSIGNMENT_OPERATOR_MAP;
