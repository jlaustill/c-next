/**
 * ADR-037 `#define` shape: E0501, E0502.
 *
 * #1322. Two throws in `IncludeGenerator.processDefineDirective`, both
 * reporting `1:0` after computing the real line and spending it on prose --
 * `… Use inline functions instead. Line 7`. A file whose offending directive
 * sits on line 7 reported position 1:0 and said "Line 7" in its message, which
 * is the exact shape this card exists to remove.
 *
 * ## The plan said these needed the preprocessor artifact. They do not.
 *
 * #1322's definition of done groups E0501/E0502 with "the six include
 * diagnostics (E0501-E0506), which need the preprocessor artifact rather than
 * a tree walk". That is false, and it is worth writing down why, because the
 * sentence reads plausible: a `#define` inside an INCLUDED C HEADER genuinely
 * is not in the C-Next parse tree -- but it never reached these throws either.
 * C headers are lexed by the C grammar, whose directive rule sends every
 * `#`-line to ANTLR's hidden channel before parsing, so a header holding
 * `#define SQUARE(x) ((x) * (x))` transpiles at exit 0 today and always did.
 * The throws' own parameter type is the proof: `DefineDirectiveContext` is a
 * C-NEXT grammar node, and the C grammar has no such rule to produce one.
 *
 * What the rule actually sees is `defineDirective`, whose three alternatives
 * ARE the three cases the throw discriminated (`DEFINE_FLAG`,
 * `DEFINE_WITH_VALUE`, `DEFINE_FUNCTION`), reached from `program`'s directive
 * children. There is nowhere else in a `.cnx` file a `#define` can parse: after
 * a declaration, inside a `scope`, or inside a function body it is a syntax
 * error, so this walk is exhaustive by construction rather than by search.
 *
 * A `#define` in an included `.cnx` is still rejected, because that file is
 * itself a pipeline file whose own tree is analyzed -- and it is attributed to
 * the included file, as it was before.
 */

import { ParseTreeWalker } from "antlr4ng";

import { CNextListener } from "../../transpiler/logic/parser/grammar/CNextListener";
import * as Parser from "../../transpiler/logic/parser/grammar/CNextParser";
import invariant from "../../utils/invariant";
import ParserUtils from "../../utils/ParserUtils";
import IDefineDirectiveError from "./types/IDefineDirectiveError";

/**
 * The macro name a `#define` declares.
 *
 * All three `defineDirective` tokens require `[a-zA-Z_][a-zA-Z0-9_]*` after
 * `define` and its whitespace, so a node that exists has a name by
 * construction and the miss is an invariant, not a case. Codegen answered
 * `"unknown"` here and put it in the user's message.
 */
const nameOf = (text: string): string => {
  const match = /#\s*define\s+([a-zA-Z_]\w*)/.exec(text);
  invariant(match !== null, "a defineDirective token always carries a name");
  return match[1];
};

class DefineDirectiveListener extends CNextListener {
  private readonly found: IDefineDirectiveError[] = [];

  public errors(): IDefineDirectiveError[] {
    return this.found;
  }

  /**
   * ADR-037 allows exactly one `#define` form -- a flag with no value, which
   * passes through to the generated C. The other two alternatives are these
   * two diagnostics, so the grammar rule is covered by naming the rejected
   * forms and nothing else.
   *
   * There is deliberately no `if (ctx.DEFINE_FLAG()) return;` early exit above
   * these. The first draft had one, described as the negative control, and
   * mutation-checking it reddened NOTHING: a flag is protected by the two
   * predicates below being false, never by that line. An arm that reads as a
   * rule and enforces nothing is worse than no arm, because the fixture beside
   * it then reads as covering something it does not.
   */
  override enterDefineDirective = (
    ctx: Parser.DefineDirectiveContext,
  ): void => {
    if (ctx.DEFINE_FUNCTION()) {
      const name = nameOf(ctx.getText());
      this.report(
        ctx,
        "E0501",
        `Function-like macro '${name}' is not allowed. Use inline functions instead.`,
        "A macro is textual substitution, so its arguments are evaluated wherever they appear and its operators bind by text (ADR-037); write an `inline` function instead.",
      );
      return;
    }

    if (ctx.DEFINE_WITH_VALUE()) {
      const name = nameOf(ctx.getText());
      this.report(
        ctx,
        "E0502",
        `#define with value '${name}' is not allowed. Use 'const' instead: const u32 ${name} <- value;`,
        "A `#define` has no type and no scope, so the compiler cannot check its use (ADR-037); a `const` has both.",
      );
    }
  };

  private report(
    at: Parser.DefineDirectiveContext,
    code: string,
    message: string,
    helpText: string,
  ): void {
    const { line, column } = ParserUtils.getPosition(at);
    this.found.push({ code, line, column, message, helpText });
  }
}

class DefineDirectiveAnalyzer {
  public analyze(tree: Parser.ProgramContext): IDefineDirectiveError[] {
    const listener = new DefineDirectiveListener();
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default DefineDirectiveAnalyzer;
