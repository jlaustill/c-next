/**
 * ADR-051's `safe_div` / `safe_mod` call shape: E0884, E0885.
 *
 * #1322. Three throws in `CallExprGenerator`, all reported as `1:0`, and one
 * of them unreachable-looking but real.
 *
 * ## Two throws, one rule
 *
 * "the first argument is not a simple identifier" and "the first argument
 * names nothing with a type" were separate throws, and they are the same
 * sentence: the output parameter must be a VARIABLE, because the generated
 * helper takes its address. `safe_div(1 + 1, ...)` fails the first,
 * `safe_div(someFunction, ...)` the second, and a reader is owed one
 * explanation rather than two.
 *
 * The second looked dead -- an undeclared name is E0427, reported earlier --
 * but a name can be declared and still not be a variable. `safe_div(helper,
 * 10, 2, 0)` where `helper` is a function reaches it, which is why this is a
 * diagnostic rather than a deletion.
 *
 * ## Not asked here
 *
 * Whether the OUTPUT is `const` is ADR-013's rule, not ADR-051's, and it is
 * reported as E0877 by the const analyzer, which reads the same
 * `SafeDivision.outputName`. A const output was accepted before #1322 and
 * emitted `&K` into a non-const pointer parameter.
 */

import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";

import { CNextListener } from "../../transpiler/logic/parser/grammar/CNextListener";
import * as Parser from "../../transpiler/logic/parser/grammar/CNextParser";
import CodeGenState from "../../transpiler/state/CodeGenState";
import ParserUtils from "../../utils/ParserUtils";
import DeclarationScopeCollector from "./DeclarationScopeCollector";
import SafeDivision from "./helpers/SafeDivision";
import ISafeDivisionError from "./types/ISafeDivisionError";
import ScopeFrameResolver from "./ScopeFrameResolver";

/** ADR-051 fixes the signature at four. */
const REQUIRED_ARGUMENTS = 4;

class SafeDivisionListener extends CNextListener {
  private readonly found: ISafeDivisionError[] = [];

  public constructor(private readonly scopes: ScopeFrameResolver) {
    super();
  }

  public errors(): ISafeDivisionError[] {
    return this.found;
  }

  override enterPostfixExpression = (
    ctx: Parser.PostfixExpressionContext,
  ): void => {
    const call = SafeDivision.callOf(ctx);
    if (call === null) return;

    if (call.args.length !== REQUIRED_ARGUMENTS) {
      this.report(
        ctx,
        "E0884",
        `${call.name} takes exactly ${REQUIRED_ARGUMENTS} arguments (output, numerator, divisor, defaultValue), not ${call.args.length}`,
        "The result is written to the first argument and the fourth is used when the divisor is zero, so neither can be left out (ADR-051).",
      );
      return;
    }

    const output = SafeDivision.outputName(call.args);
    if (output === null) {
      this.report(
        call.args[0],
        "E0885",
        `${call.name} writes its result to the first argument, so it must be a variable`,
        "The generated helper takes the output's address; an expression has none. Declare a variable and pass it (ADR-051).",
      );
      return;
    }

    // A name that resolves to nothing is E0427's to report -- saying it twice
    // for one mistake is what the analyzer order exists to prevent.
    if (!this.isDeclared(output, ctx)) return;
    if (this.isVariable(output, ctx)) return;

    this.report(
      call.args[0],
      "E0885",
      `${call.name} writes its result to the first argument, and '${output}' is not a variable`,
      "The generated helper takes the output's address. Declare a variable of the result's type and pass that (ADR-051).",
    );
  };

  /** Whether anything at all declares this name where the call stands. */
  private isDeclared(name: string, at: ParserRuleContext): boolean {
    if (this.isVariable(name, at)) return true;
    const symbols = CodeGenState.symbols;
    return (
      symbols?.functionReturnTypes.has(name) === true ||
      CodeGenState.program?.symbolByCName(name) !== undefined
    );
  }

  /** Whether the name is a variable: a lexical declaration, or the program's. */
  private isVariable(name: string, at: ParserRuleContext): boolean {
    const frame = this.scopes.frameFor(at);
    if (this.scopes.declarationOfNameLexical(name, frame) !== null) return true;
    return CodeGenState.program?.symbolByCName(name)?.kind === "variable";
  }

  private report(
    at: ParserRuleContext,
    code: string,
    message: string,
    helpText: string,
  ): void {
    const { line, column } = ParserUtils.getPosition(at);
    this.found.push({ code, line, column, message, helpText });
  }
}

class SafeDivisionAnalyzer {
  public analyze(tree: Parser.ProgramContext): ISafeDivisionError[] {
    const declarations = new DeclarationScopeCollector();
    ParseTreeWalker.DEFAULT.walk(declarations, tree);
    const listener = new SafeDivisionListener(
      new ScopeFrameResolver(declarations),
    );
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default SafeDivisionAnalyzer;
