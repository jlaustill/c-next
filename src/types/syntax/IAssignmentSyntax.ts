import type ISyntaxNode from "./ISyntaxNode";
import type TAssignmentOperator from "./TAssignmentOperator";
import type TExpression from "./TExpression";

/** `target op value` -- a statement, a for-header init or a for update */
interface IAssignmentSyntax extends ISyntaxNode {
  /** The lowered `assignmentTarget`: an identifier, a root or a postfix chain */
  readonly target: TExpression;
  readonly operator: TAssignmentOperator;
  readonly value: TExpression;
}

export default IAssignmentSyntax;
