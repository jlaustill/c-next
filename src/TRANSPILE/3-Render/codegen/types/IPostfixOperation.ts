/**
 * Represents a postfix operation in a chain
 */
interface IPostfixOperation {
  /** Member name if this is a member access */
  memberName: string | null;
  /** Expressions for array subscript or bit range */
  expressions: unknown[];
}

export default IPostfixOperation;
