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
import { CNextListener } from "../../transpiler/logic/parser/grammar/CNextListener";
import * as Parser from "../../transpiler/logic/parser/grammar/CNextParser";
import IScopeFrame from "./types/IScopeFrame";
import IDeclaredVar from "./types/IDeclaredVar";
import EnclosingScope from "./helpers/EnclosingScope";

class DeclarationScopeCollector extends CNextListener {
  private readonly globalFrame: IScopeFrame = {
    vars: new Map(),
    parent: null,
    scopePath: "",
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
      scopePath:
        scopeLeaf === undefined
          ? parent.scopePath
          : EnclosingScope.child(parent.scopePath, scopeLeaf),
    };
    this.frameOf.set(node, frame);
    this.stack.push(frame);
  }

  private popFrame(): void {
    this.stack.pop();
  }

  /**
   * #1322: dimensions come from the TYPE, not from trailing brackets after the
   * name. C-Next declares an array as `u32[10] buffer`; the C-style
   * `u32 buffer[10]` is rejected outright by
   * `VariableDeclHelper.validateArrayDeclarationSyntax`, so a declaration that
   * reaches here with trailing dimensions is one the transpiler will refuse
   * anyway. Reading `arrayType()` is therefore reading the only spelling that
   * can be valid, not the commoner of two.
   */
  private static dimensionsOf(
    typeCtx: Parser.TypeContext,
  ): readonly (number | string)[] {
    const arrayType = typeCtx.arrayType();
    if (!arrayType) return [];
    return arrayType.arrayTypeDimension().map((dimension) => {
      const text = dimension.expression()?.getText() ?? "";
      const literal = Number.parseInt(text, 10);
      // A dimension may name a const or a C macro. `Number.isNaN` is the whole
      // discriminator: a bounds check can run against a number and must decline
      // against a name, and collapsing the two here would remove its ability to.
      return Number.isNaN(literal) ? text : literal;
    });
  }

  /** `N` from `string<N>`; null when the type is not a string. */
  private static capacityOf(typeCtx: Parser.TypeContext): number | null {
    const digits = typeCtx.stringType()?.INTEGER_LITERAL()?.getText();
    if (digits === undefined) return null;
    const capacity = Number.parseInt(digits, 10);
    return Number.isNaN(capacity) ? null : capacity;
  }

  private record(
    typeCtx: Parser.TypeContext | null,
    identifier: { getText(): string } | null,
    declared: IDeclaredVar | null = null,
  ): void {
    if (!typeCtx || !identifier) return;
    this.top().vars.set(
      identifier.getText(),
      declared ?? {
        typeText: typeCtx.getText(),
        dimensions: DeclarationScopeCollector.dimensionsOf(typeCtx),
        stringCapacity: DeclarationScopeCollector.capacityOf(typeCtx),
        isConst: false,
      },
    );
  }

  /** The shared record, with const-ness read from a context that carries it. */
  private recordWithModifiers(
    typeCtx: Parser.TypeContext | null,
    identifier: { getText(): string } | null,
    isConst: boolean,
  ): void {
    if (!typeCtx || !identifier) return;
    this.record(typeCtx, identifier, {
      typeText: typeCtx.getText(),
      dimensions: DeclarationScopeCollector.dimensionsOf(typeCtx),
      stringCapacity: DeclarationScopeCollector.capacityOf(typeCtx),
      isConst,
    });
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
    this.recordWithModifiers(
      ctx.type(),
      ctx.IDENTIFIER(),
      ctx.constModifier() !== null,
    );
  };

  override enterParameter = (ctx: Parser.ParameterContext): void => {
    this.recordWithModifiers(
      ctx.type(),
      ctx.IDENTIFIER(),
      ctx.constModifier() !== null,
    );
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
