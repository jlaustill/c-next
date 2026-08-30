/**
 * Declaration Scope Collector
 *
 * First pass shared by the essential-type analyzers: build per-scope frames
 * (function, named scope, block, and for-loop header) so a name is resolved
 * against ITS scope. A same-named variable of a different type in another
 * function OR a nested block never poisons a lookup (Issue #1085 review).
 *
 * Frames are anchored to the context node that opened them, so a second pass
 * finds an operand's frame by walking up its parent chain -- no shared walk
 * state between the passes.
 *
 * Extracted from MixedTypeCategoryAnalyzer (Issue #1183) so Rule 10.1 and Rule
 * 10.4 resolve declarations through one implementation instead of each carrying
 * its own copy of the scope-shadowing logic.
 */

import { ParserRuleContext } from "antlr4ng";
import { CNextListener } from "../parser/grammar/CNextListener";
import * as Parser from "../parser/grammar/CNextParser";
import IScopeFrame from "./types/IScopeFrame";
import EnclosingScope from "./helpers/EnclosingScope";

class DeclarationScopeCollector extends CNextListener {
  private readonly globalFrame: IScopeFrame = {
    vars: new Map(),
    parent: null,
    scope: null,
  };

  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  private readonly frameOf: Map<ParserRuleContext, IScopeFrame> = new Map();

  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  private readonly stack: IScopeFrame[] = [this.globalFrame];

  public getGlobalFrame(): IScopeFrame {
    return this.globalFrame;
  }

  public getFrameOf(): Map<ParserRuleContext, IScopeFrame> {
    return this.frameOf;
  }

  private top(): IScopeFrame {
    return this.stack.at(-1) ?? this.globalFrame;
  }

  private pushFrame(node: ParserRuleContext, scopeLeaf?: string): void {
    const parent = this.top();
    const frame: IScopeFrame = {
      vars: new Map(),
      parent,
      // Inherited so a nested block inside a scope still knows its scope.
      // #1357: descending from the PARENT scope keeps the outer components, so
      // a scope declared inside another is not flattened to its leaf.
      scope:
        scopeLeaf === undefined
          ? parent.scope
          : EnclosingScope.child(parent.scope, scopeLeaf),
    };
    this.frameOf.set(node, frame);
    this.stack.push(frame);
  }

  private popFrame(): void {
    this.stack.pop();
  }

  private record(
    typeCtx: Parser.TypeContext | null,
    identifier: { getText(): string } | null,
  ): void {
    if (!typeCtx || !identifier) return;
    this.top().vars.set(identifier.getText(), typeCtx.getText());
  }

  override enterFunctionDeclaration = (
    ctx: Parser.FunctionDeclarationContext,
  ): void => {
    this.pushFrame(ctx);
  };

  override exitFunctionDeclaration = (): void => {
    this.popFrame();
  };

  override enterScopeDeclaration = (
    ctx: Parser.ScopeDeclarationContext,
  ): void => {
    this.pushFrame(ctx, ctx.IDENTIFIER()?.getText());
  };

  override exitScopeDeclaration = (): void => {
    this.popFrame();
  };

  override enterVariableDeclaration = (
    ctx: Parser.VariableDeclarationContext,
  ): void => {
    this.record(ctx.type(), ctx.IDENTIFIER());
  };

  override enterParameter = (ctx: Parser.ParameterContext): void => {
    this.record(ctx.type(), ctx.IDENTIFIER());
  };

  override enterForVarDecl = (ctx: Parser.ForVarDeclContext): void => {
    this.record(ctx.type(), ctx.IDENTIFIER());
  };

  // Each braced block (if/while/for body, and a function/scope body) is its own
  // lexical scope, so a different-type redeclaration shadows only within the
  // block instead of poisoning the name function-wide (Issue #1085 review).
  override enterBlock = (ctx: Parser.BlockContext): void => {
    this.pushFrame(ctx);
  };

  override exitBlock = (): void => {
    this.popFrame();
  };

  // The for-loop header is its own scope so the loop variable is confined to the
  // loop (header + body) and never overwrites an outer same-named variable.
  override enterForStatement = (ctx: Parser.ForStatementContext): void => {
    this.pushFrame(ctx);
  };

  override exitForStatement = (): void => {
    this.popFrame();
  };
}

export default DeclarationScopeCollector;
