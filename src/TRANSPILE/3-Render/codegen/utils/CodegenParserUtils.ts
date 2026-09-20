/**
 * Parser utilities specific to code generation.
 *
 * These utilities depend on ANTLR parser types and are used by CodeGenerator.
 * Separated from src/utils/ParserUtils.ts to avoid circular dependencies.
 */

import { ParserRuleContext, TerminalNode } from "antlr4ng";

/**
 * Static utility methods for parser context operations in code generation.
 */
class CodegenParserUtils {
  /**
   * Extract operators from parse tree children in order.
   *
   * When parsing expressions like "a + b - c", ANTLR creates children
   * with operands interleaved: [a, +, b, -, c]. This method extracts
   * just the operators as terminal nodes.
   *
   * Note: Using children.filter() loses operator ordering when operators
   * are detected using text.includes(), so we iterate explicitly.
   *
   * @param ctx - The parser rule context containing operands and operators
   * @returns Array of operator strings in the order they appear
   */
  static getOperatorsFromChildren(ctx: ParserRuleContext): string[] {
    const operators: string[] = [];
    for (const child of ctx.children) {
      if (child instanceof TerminalNode) {
        operators.push(child.getText());
      }
    }
    return operators;
  }

  // #1322: `isMainFunctionWithArgs` moved to `ParserUtils` (src/utils), which
  // pass 2.1 may import: E0874/E0875 have to exempt main's args parameter by
  // the same criterion codegen lowers it with, and a second copy of that
  // criterion is the duplicate-path shape.
}

export default CodegenParserUtils;
