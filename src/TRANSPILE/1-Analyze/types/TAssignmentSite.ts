import * as Parser from "../../../PARSE/2-Parse/grammar/CNextParser";

/**
 * An assignment, however the grammar spells it: a statement, a for-loop
 * initializer or a for-loop update. All three have the same children -- a
 * target, an operator and a value.
 */
type TAssignmentSite =
  | Parser.AssignmentStatementContext
  | Parser.ForAssignmentContext
  | Parser.ForUpdateContext;

export default TAssignmentSite;
