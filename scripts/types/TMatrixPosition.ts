/**
 * Issue #1618: where in a statement a value lands in its typed target.
 *
 * A context says which declaration encloses a diagnostic; a position says
 * which part of the statement it reports. E0869 was enforced at a declaration
 * and silent at a return in the same function, and both filled one cell.
 */
type TMatrixPosition =
  | "declaration-initializer"
  | "assignment"
  | "array-element-assignment"
  | "struct-field-assignment"
  | "compound-assignment"
  | "return-statement"
  | "call-argument"
  | "array-element-initializer"
  | "struct-field-initializer"
  | "ternary-branch";

export default TMatrixPosition;
