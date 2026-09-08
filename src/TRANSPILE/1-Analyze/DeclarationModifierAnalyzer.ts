/**
 * ADR-049 declaration modifiers: E0889.
 *
 * #1322. One throw in `VariableModifierBuilder`, reported as `1:0` with its
 * position built into the message text.
 *
 * `atomic` already implies `volatile` -- it is `volatile` plus the guarantee
 * that a read or write cannot be torn -- so writing both says one of two
 * things, and the author has to be asked which. The rule is entirely
 * syntactic: two modifier tokens on one declaration, which is why it needs no
 * type, no frame and no symbols.
 *
 * Every declaration form is checked. Codegen's copy sat in the builder that
 * file-scope and block declarations share, so it saw both; a `for` header's
 * declaration and a parameter carry the same modifiers in the grammar and are
 * asked here too rather than being assumed unreachable.
 */

import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";

import { CNextListener } from "../../transpiler/logic/parser/grammar/CNextListener";
import * as Parser from "../../transpiler/logic/parser/grammar/CNextParser";
import ParserUtils from "../../utils/ParserUtils";
import IDeclarationModifierError from "./types/IDeclarationModifierError";

class DeclarationModifierListener extends CNextListener {
  private readonly found: IDeclarationModifierError[] = [];

  public errors(): IDeclarationModifierError[] {
    return this.found;
  }

  override enterVariableDeclaration = (
    ctx: Parser.VariableDeclarationContext,
  ): void => {
    this.check(ctx, ctx.atomicModifier(), ctx.volatileModifier());
  };

  override enterForVarDecl = (ctx: Parser.ForVarDeclContext): void => {
    this.check(ctx, ctx.atomicModifier(), ctx.volatileModifier());
  };

  private check(
    at: ParserRuleContext,
    atomic: Parser.AtomicModifierContext | null,
    volatileMod: Parser.VolatileModifierContext | null,
  ): void {
    if (atomic === null || volatileMod === null) return;
    const { line, column } = ParserUtils.getPosition(at);
    this.found.push({
      code: "E0889",
      line,
      column,
      message: "Cannot use both 'atomic' and 'volatile' on one declaration",
      helpText:
        "`atomic` already implies `volatile`, and adds that a read or write cannot be torn. Use `atomic` for a variable an ISR shares, or `volatile` alone for a hardware register or a delay loop (ADR-049).",
    });
  }
}

class DeclarationModifierAnalyzer {
  public analyze(tree: Parser.ProgramContext): IDeclarationModifierError[] {
    const listener = new DeclarationModifierListener();
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default DeclarationModifierAnalyzer;
