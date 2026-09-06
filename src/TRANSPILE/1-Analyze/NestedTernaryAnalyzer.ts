/**
 * E0710: a ternary may not appear inside another ternary's branches (ADR-022).
 *
 * #1322. The check this replaces was a SUBSTRING TEST on the branch's source
 * text:
 *
 *     const text = ctx.getText();
 *     if (text.includes("?") && text.includes(":")) { throw ... }
 *
 * which rejects `(n = 1) ? "a?b:c" : "plain"`. That is a legal ternary whose
 * true branch is a string literal containing both characters, and it was
 * reported as a nested ternary -- verified by probe before this existed.
 *
 * A rule about syntax was asking about characters. The parse tree already knows
 * whether a branch contains a ternary, so it is asked.
 *
 * ## The traversal, and the trap CLAUDE.md records
 *
 * `ternaryExpression` carries THREE `orExpression` children: `[0]` condition,
 * `[1]` true value, `[2]` false value. They must be addressed through
 * `orExpression(i)` and never `getChild(i)` -- the condition is parenthesised,
 * so `getChild(0)` is the `(` token and an index-based skip silently does
 * nothing. That is a documented bug in this project.
 *
 * ## All three are searched, and the codegen check searched two
 *
 * `validateNoNestedTernary` was called on `orExprs[1]` and `orExprs[2]` only.
 * ADR-022 says "no nesting allowed" without qualification, so the CONDITION was
 * a hole: `(((n = 1) ? 2 : 3) = 2) ? 4 : 5` parses, compiles, and emits C --
 * verified by probe, and the whole nesting sits inside a comparison, so E0701
 * (a condition must be a comparison) is satisfied and does not fire either.
 *
 * The first version of this analyzer reproduced the hole and justified it in
 * this comment by asserting E0701 owned the case. That was never probed and was
 * false. Searching all three children closes it; a corpus scan of 1276 `.cnx`
 * files found zero conditions containing a ternary, so nothing legal regresses.
 */

import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";

import { CNextListener } from "../../transpiler/logic/parser/grammar/CNextListener";
import * as Parser from "../../transpiler/logic/parser/grammar/CNextParser";
import ParserUtils from "../../utils/ParserUtils";
import INestedTernaryError from "./types/INestedTernaryError";

/**
 * A `ternaryExpression` node that is really a ternary.
 *
 * The grammar threads every expression through this rule, so most instances
 * carry a single `orExpression` and no `?`. The `COLON` token is what marks a
 * real one -- a structural fact, not a character search of the text.
 */
const isTernary = (ctx: ParserRuleContext): boolean =>
  ctx instanceof Parser.TernaryExpressionContext && ctx.COLON() !== null;

/** Whether `node`'s subtree contains a real ternary. */
const containsTernary = (node: ParserRuleContext): boolean => {
  if (isTernary(node)) return true;
  for (let index = 0; index < node.getChildCount(); index += 1) {
    const child = node.getChild(index);
    if (child instanceof ParserRuleContext && containsTernary(child)) {
      return true;
    }
  }
  return false;
};

class NestedTernaryListener extends CNextListener {
  private readonly found: INestedTernaryError[] = [];

  public errors(): INestedTernaryError[] {
    return this.found;
  }

  override enterTernaryExpression = (
    ctx: Parser.TernaryExpressionContext,
  ): void => {
    if (ctx.COLON() === null) return;

    for (const [index, branch] of [
      [0, "condition"],
      [1, "true branch"],
      [2, "false branch"],
    ] as const) {
      const value = ctx.orExpression(index);
      if (value === null || !containsTernary(value)) continue;
      const { line, column } = ParserUtils.getPosition(value);
      this.found.push({
        code: "E0710",
        line,
        column,
        message: `Nested ternary not allowed in ${branch}`,
        helpText:
          "A ternary inside a ternary is hard to read and hard to certify (ADR-022). Use if/else, or lift the inner expression into a named variable first.",
      });
    }
  };
}

class NestedTernaryAnalyzer {
  public analyze(tree: Parser.ProgramContext): INestedTernaryError[] {
    const listener = new NestedTernaryListener();
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default NestedTernaryAnalyzer;
