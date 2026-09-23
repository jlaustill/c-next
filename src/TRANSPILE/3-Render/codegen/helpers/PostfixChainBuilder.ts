/**
 * Postfix Chain Builder
 *
 * Processes postfix operations (member access, array subscript, bit range)
 * in assignment target chains.
 *
 * Extracted from CodeGenerator.doGenerateAssignmentTarget to reduce
 * cognitive complexity.
 */

import IPostfixChainDeps from "../types/IPostfixChainDeps";
import IPostfixOperation from "../types/IPostfixOperation";

/**
 * Static utility for building postfix operation chains
 */
class PostfixChainBuilder {
  /**
   * Process a chain of postfix operations and build the result string
   *
   * @param baseResult The starting string (base identifier)
   * @param firstId The first identifier in the chain (for register detection)
   * @param operations Array of postfix operations to process
   * @param deps Dependencies for expression generation and separator resolution
   * @returns The complete result string with all postfix operations applied
   */
  static build(
    baseResult: string,
    firstId: string,
    operations: IPostfixOperation[],
    deps: IPostfixChainDeps,
  ): string {
    let result = baseResult;
    const identifierChain: string[] = [firstId];
    let isFirstOp = true;

    for (const op of operations) {
      if (op.memberName) {
        result = PostfixChainBuilder.processMemberAccess(
          result,
          op.memberName,
          identifierChain,
          isFirstOp,
          deps,
        );
        identifierChain.push(op.memberName);
      } else {
        result = PostfixChainBuilder.processSubscript(result, op);
      }
      isFirstOp = false;
    }

    return result;
  }

  /**
   * Process a member access operation (.identifier)
   */
  private static processMemberAccess(
    result: string,
    memberName: string,
    identifierChain: string[],
    isFirstOp: boolean,
    deps: IPostfixChainDeps,
  ): string {
    const chainWithMember = [...identifierChain, memberName];
    const separator = deps.getSeparator(isFirstOp, chainWithMember);
    return `${result}${separator}${memberName}`;
  }

  /**
   * Process a subscript operation ([expr] or [expr, expr])
   */
  private static processSubscript(
    result: string,
    op: IPostfixOperation,
  ): string {
    // #1652: the count decides, and only then does the render happen -- inside
    // the branch, never before it. Rendering an index queues a pending temp
    // declaration, so hoisting these calls above the `if` would queue one for
    // the shape that returns `result` unchanged.
    if (op.indexCount === 1) {
      // Single subscript: array access or single bit
      const [indexExpr] = op.renderIndexes();
      return `${result}[${indexExpr}]`;
    }

    if (op.indexCount === 2) {
      // Bit range: [start, width]
      const [start, width] = op.renderIndexes();
      return `${result}[${start}, ${width}]`;
    }

    // No expressions - shouldn't happen, but handle gracefully
    return result;
  }
}

export default PostfixChainBuilder;
