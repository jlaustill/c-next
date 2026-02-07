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
      if (op.memberName !== null) {
        result = PostfixChainBuilder.processMemberAccess(
          result,
          op.memberName,
          identifierChain,
          isFirstOp,
          deps,
        );
        identifierChain.push(op.memberName);
      } else {
        result = PostfixChainBuilder.processSubscript(
          result,
          op.expressions,
          deps,
        );
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
    const separator = deps.getSeparator(isFirstOp, chainWithMember, memberName);
    return `${result}${separator}${memberName}`;
  }

  /**
   * Process a subscript operation ([expr] or [expr, expr])
   */
  private static processSubscript(
    result: string,
    expressions: unknown[],
    deps: IPostfixChainDeps,
  ): string {
    if (expressions.length === 1) {
      // Single subscript: array access or single bit
      const indexExpr = deps.generateExpression(expressions[0]);
      return `${result}[${indexExpr}]`;
    }

    if (expressions.length === 2) {
      // Bit range: [start, width]
      const start = deps.generateExpression(expressions[0]);
      const width = deps.generateExpression(expressions[1]);
      return `${result}[${start}, ${width}]`;
    }

    // No expressions - shouldn't happen, but handle gracefully
    return result;
  }
}

export default PostfixChainBuilder;
