/**
 * Dependencies needed for postfix chain building
 */
interface IPostfixChainDeps {
  /** Generate an expression to a string */
  generateExpression(expr: unknown): string;

  /** Get separator for member access */
  getSeparator(
    isFirstOp: boolean,
    identifierChain: string[],
    memberName: string,
  ): string;
}

export default IPostfixChainDeps;
