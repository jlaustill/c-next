/**
 * `this` is only meaningful inside a `scope` (ADR-016).
 *
 * #1322, the first family relocated out of `output/`. This rule was enforced
 * from FOUR places -- `CodeGenerator`, `BaseIdentifierBuilder`, and
 * `PostfixExpressionGenerator` twice -- each throwing the identical string, and
 * a fifth, `CodeGenErrors.scopedTypeOutsideScope`, had no caller at all. Four
 * more copies were unreachable and were deleted in 1322a: `this.x <- 5` at file
 * scope is a PARSE error, so the assignment-path guards could never fire.
 *
 * Every copy reached the user as `1:0`, because a throw from codegen carries no
 * position -- `ParserUtils.parseErrorLocation` has nothing to scrape and falls
 * back. That is the defect this card exists to fix, and it is why the rule
 * moves rather than being tidied where it stood.
 *
 * ## Why this family first
 *
 * The rule is purely syntactic: is this `this` lexically inside a
 * `scopeDeclaration`? It needs no symbol table, no type registry, and no
 * cross-file fact, so it exercises the relocation end to end without also
 * depending on what 2.1 can see -- which is a separate question, and the one
 * `IDeclaredVar` answers.
 *
 * ## All three contexts, not just the obvious one
 *
 * `THIS` appears in `PrimaryExpressionContext` (a read), `AssignmentTargetContext`
 * (a write) and `ScopedTypeContext` (`this.Type` in a type position). A walk
 * that visited only expressions would silently stop rejecting the other two,
 * which is how a rule with a hole becomes more dangerous than no rule: people
 * trust it.
 *
 * ## One behavior change, asserted rather than discovered
 *
 * A throw aborts at the first occurrence; this reports every `this` in the file.
 * Fixtures with more than one offending line therefore gain lines rather than
 * changing them.
 */

import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";

import { CNextListener } from "../../transpiler/logic/parser/grammar/CNextListener";
import * as Parser from "../../transpiler/logic/parser/grammar/CNextParser";
import ParserUtils from "../../utils/ParserUtils";
import IThisOutsideScopeError from "./types/IThisOutsideScopeError";

/**
 * Tracks how many `scope` declarations are open, and reports any `this` seen
 * while none is.
 *
 * A depth counter rather than `EnclosingScope`: this asks only whether it is
 * inside one, never which, so carrying the path would be state with no reader.
 */
class ThisOutsideScopeListener extends CNextListener {
  private depth = 0;

  private readonly found: IThisOutsideScopeError[] = [];

  public errors(): IThisOutsideScopeError[] {
    return this.found;
  }

  override enterScopeDeclaration = (): void => {
    this.depth += 1;
  };

  override exitScopeDeclaration = (): void => {
    this.depth -= 1;
  };

  override enterPrimaryExpression = (
    ctx: Parser.PrimaryExpressionContext,
  ): void => {
    if (ctx.THIS()) this.report(ctx);
  };

  override enterAssignmentTarget = (
    ctx: Parser.AssignmentTargetContext,
  ): void => {
    if (ctx.THIS()) this.report(ctx);
  };

  override enterScopedType = (ctx: Parser.ScopedTypeContext): void => {
    if (ctx.THIS()) this.report(ctx);
  };

  private report(ctx: ParserRuleContext): void {
    if (this.depth > 0) return;
    const { line, column } = ParserUtils.getPosition(ctx);
    this.found.push({
      code: "E0431",
      line,
      column,
      message: "'this' can only be used inside a scope",
      helpText:
        "`this` names the enclosing scope's own member. Outside a scope, write `global.Name` for a file-scope declaration, or move the code into the scope it belongs to.",
    });
  }
}

class ThisOutsideScopeAnalyzer {
  public analyze(tree: Parser.ProgramContext): IThisOutsideScopeError[] {
    const listener = new ThisOutsideScopeListener();
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default ThisOutsideScopeAnalyzer;
