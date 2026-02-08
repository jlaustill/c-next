/**
 * Parser utilities specific to code generation.
 *
 * These utilities depend on ANTLR parser types and are used by CodeGenerator.
 * Separated from src/utils/ParserUtils.ts to avoid circular dependencies.
 */

import { ParserRuleContext, TerminalNode } from "antlr4ng";
import * as Parser from "../../../logic/parser/grammar/CNextParser";

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

  /**
   * Check if this is the main function with command-line args parameter.
   * Supports: u8 args[][] (legacy) or string args[] (preferred)
   *
   * @param name - Function name
   * @param paramList - Parameter list context
   * @returns true if this is main with args parameter
   */
  static isMainFunctionWithArgs(
    name: string,
    paramList: Parser.ParameterListContext | null,
  ): boolean {
    if (name !== "main" || !paramList) {
      return false;
    }

    const params = paramList.parameter();
    if (params.length !== 1) {
      return false;
    }

    const param = params[0];
    const typeCtx = param.type();
    const dims = param.arrayDimension();

    // Check for string args[] (preferred - array of strings)
    if (typeCtx.stringType() && dims.length === 1) {
      return true;
    }

    // Check for u8 args[][] (legacy - 2D array of bytes)
    const type = typeCtx.getText();
    return (type === "u8" || type === "i8") && dims.length === 2;
  }
}

export default CodegenParserUtils;
