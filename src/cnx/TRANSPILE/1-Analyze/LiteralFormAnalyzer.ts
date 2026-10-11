/**
 * Literal Form Analyzer
 * ADR-044 "Integer Literals" (owner ruling, 2026-10-03, #1728): an integer
 * literal is decimal, `0x` hexadecimal or `0b` binary. There is no octal
 * literal, so a decimal literal never has a leading zero: `010` is E0912.
 *
 * C reads `010` as 8. The transpiler read it as 10 in some places and as no
 * value in others, so one spelling could mean two numbers in one program.
 * Every literal token is checked, wherever the grammar allows one: a const, a
 * dimension, a bitmap field width, a case label, an operand.
 */

import { ParseTreeWalker, TerminalNode } from "antlr4ng";
import { CNextListener } from "../../PARSE/2-Parse/grammar/CNextListener";
import * as Parser from "../../PARSE/2-Parse/grammar/CNextParser";
import LiteralUtils from "../../utils/LiteralUtils";
import type IBaseAnalysisError from "./types/IBaseAnalysisError";

/** The decimal literal tokens, suffixed or not; hex and binary have a prefix */
const DECIMAL_TOKENS: ReadonlySet<number> = new Set([
  Parser.CNextParser.INTEGER_LITERAL,
  Parser.CNextParser.SUFFIXED_DECIMAL,
]);

class LiteralFormListener extends CNextListener {
  readonly errors: IBaseAnalysisError[] = [];

  override visitTerminal = (node: TerminalNode): void => {
    const literal = node.getText();
    if (
      !DECIMAL_TOKENS.has(node.symbol.type) ||
      !LiteralUtils.hasLeadingZero(literal)
    ) {
      return;
    }
    this.errors.push({
      code: "E0912",
      line: node.symbol.line,
      column: node.symbol.column,
      message: `Integer literal '${literal}' has a leading zero: C-Next has no octal literal (ADR-044)`,
      helpText:
        "Write the value in decimal without the leading zero, or as 0x... or 0b...",
    });
  };
}

class LiteralFormAnalyzer {
  analyze(tree: Parser.ProgramContext): IBaseAnalysisError[] {
    const listener = new LiteralFormListener();
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors;
  }
}

export default LiteralFormAnalyzer;
