/**
 * #1668 / #1664: a file's lexical frames -- every scope, function, braced
 * block and `for` header, what each declares, and how they nest.
 *
 * 2.1 and 2.2 each answered "what does this name mean HERE" from their own
 * walk: 2.1 from per-analyzer frame maps keyed on parse nodes, 2.2 from one
 * flat registry keyed by name, which a shadowing local overwrote. This is the
 * one answer, built once by 1.3 from one file's tree and holding no parse
 * node, so it rides on `IFileSymbols` and 1.4 settles it with the rest.
 *
 * Globals and scope members are not recorded: they are `IVariableSymbol`s.
 * A local's facts come from `VariableCollector.declaredFacts` and a
 * parameter's from `FunctionCollector.collectParameters`, the functions that
 * already derive them for symbols, so a declaration means the same thing
 * wherever it is written.
 */
import { ParserRuleContext, ParseTreeWalker, TerminalNode } from "antlr4ng";

import { CNextListener } from "../../../2-Parse/grammar/CNextListener";
import * as Parser from "../../../2-Parse/grammar/CNextParser";
import FunctionCollector from "./FunctionCollector";
import VariableCollector from "./VariableCollector";
import type SymbolRegistry from "../../SymbolRegistry";
import OverflowBehaviorUtils from "../../../../utils/OverflowBehaviorUtils";
import ParserUtils from "../../../../utils/ParserUtils";
import ScopeUtils from "../../../../utils/ScopeUtils";
import type ILexicalFrame from "../../../../transpiler/types/ILexicalFrame";
import type ILocalDeclaration from "../../../../transpiler/types/ILocalDeclaration";
import type ISourceSpan from "../../../../transpiler/types/ISourceSpan";

/** A frame while it is being filled */
interface IFrameBuilder {
  readonly kind: ILexicalFrame["kind"];
  readonly span: ISourceSpan;
  readonly scopePath: string;
  readonly functionCName: string | null;
  readonly declarations: ILocalDeclaration[];
  readonly children: IFrameBuilder[];
}

class FrameListener extends CNextListener {
  private readonly stack: IFrameBuilder[];

  constructor(
    root: IFrameBuilder,
    private readonly registry: SymbolRegistry,
    private readonly isScopeType: (qualifiedName: string) => boolean,
  ) {
    super();
    this.stack = [root];
  }

  private top(): IFrameBuilder {
    return this.stack.at(-1)!;
  }

  private push(
    kind: ILexicalFrame["kind"],
    ctx: ParserRuleContext,
    scopePath: string,
    functionCName: string | null = null,
  ): void {
    const frame: IFrameBuilder = {
      kind,
      span: ParserUtils.getSpan(ctx),
      scopePath,
      functionCName,
      declarations: [],
      children: [],
    };
    this.top().children.push(frame);
    this.stack.push(frame);
  }

  private readonly pop = (): void => {
    this.stack.pop();
  };

  private static spanOf(node: TerminalNode): ISourceSpan {
    return ParserUtils.getSpan({ start: node.symbol, stop: node.symbol });
  }

  override enterScopeDeclaration = (
    ctx: Parser.ScopeDeclarationContext,
  ): void => {
    this.push(
      "scope",
      ctx,
      ScopeUtils.pathOf(
        this.registry.getOrCreateScope(ctx.IDENTIFIER().getText()),
      ),
    );
  };

  override exitScopeDeclaration = this.pop;

  override enterFunctionDeclaration = (
    ctx: Parser.FunctionDeclarationContext,
  ): void => {
    const scopePath = this.top().scopePath;
    this.push(
      "function",
      ctx,
      scopePath,
      ScopeUtils.getTranspiledCName({
        name: ctx.IDENTIFIER().getText(),
        scopePath,
      }),
    );

    const params = ctx.parameterList()?.parameter() ?? [];
    const infos = FunctionCollector.collectParameters(
      params,
      scopePath,
      this.isScopeType,
    );
    infos.forEach((info, index) => {
      this.top().declarations.push({
        name: info.name,
        kind: "parameter",
        span: FrameListener.spanOf(params[index].IDENTIFIER()),
        type: info.type,
        arrayDimensions: info.arrayDimensions ?? [],
        isConst: info.isConst,
        isAtomic: false,
        isVolatile: false,
        // A parameter has no overflow modifier in the grammar
        overflowBehavior: OverflowBehaviorUtils.fromModifier(null),
        initialValue: null,
        initializerCallee: null,
        constValue: null,
      });
    });
  };

  override exitFunctionDeclaration = this.pop;

  override enterBlock = (ctx: Parser.BlockContext): void => {
    this.push("block", ctx, this.top().scopePath);
  };

  override exitBlock = this.pop;

  override enterForStatement = (ctx: Parser.ForStatementContext): void => {
    this.push("for", ctx, this.top().scopePath);
  };

  override exitForStatement = this.pop;

  override enterVariableDeclaration = (
    ctx: Parser.VariableDeclarationContext,
  ): void => {
    const frame = this.top();
    // At file or scope level this is a global or member: a symbol, not a local
    if (frame.kind === "file" || frame.kind === "scope") {
      return;
    }
    this.record(ctx, ctx.constructorArgumentList() ? "constructor" : "local");
  };

  override enterForVarDecl = (ctx: Parser.ForVarDeclContext): void => {
    this.record(ctx, "for");
  };

  private record(
    ctx: Parser.VariableDeclarationContext | Parser.ForVarDeclContext,
    kind: ILocalDeclaration["kind"],
  ): void {
    const frame = this.top();
    // #1664 box 7: a local's `u8[N]` keeps `N` as text, so 1.4 folds it where
    // it is declared -- after a local `const N` that shadows a global one.
    const facts = VariableCollector.declaredFacts(
      ctx,
      frame.scopePath,
      this.isScopeType,
    );
    frame.declarations.push({
      name: ctx.IDENTIFIER().getText(),
      kind,
      span: FrameListener.spanOf(ctx.IDENTIFIER()),
      type: facts.type,
      arrayDimensions: facts.arrayDimensions,
      isConst: facts.isConst,
      isAtomic: facts.isAtomic,
      isVolatile: facts.isVolatile,
      overflowBehavior: facts.overflowBehavior,
      initialValue: facts.initialValue ?? null,
      initializerCallee: facts.initializerCallee,
      constValue: null,
    });
  }
}

class LexicalScopeCollector {
  /**
   * The file frame of `tree`, with every frame nested in it.
   *
   * Array dimensions are left for 1.4 to fold in each declaration's lexical
   * environment, except a literal or `sizeof`, which needs no const.
   *
   * @param isScopeType ADR-057: is this QUALIFIED name a scope type this file
   *   declares? A bare type it cannot settle is deferred, as for symbols
   */
  static collect(
    tree: Parser.ProgramContext,
    registry: SymbolRegistry,
    isScopeType: (qualifiedName: string) => boolean,
  ): ILexicalFrame {
    const root: IFrameBuilder = {
      kind: "file",
      span: ParserUtils.getSpan(tree),
      scopePath: "",
      functionCName: null,
      declarations: [],
      children: [],
    };
    ParseTreeWalker.DEFAULT.walk(
      new FrameListener(root, registry, isScopeType),
      tree,
    );
    return root;
  }
}

export default LexicalScopeCollector;
