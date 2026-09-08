/**
 * ADR-014 struct initializers: E0357.
 *
 * #1322. Two throws in `CodeGenerator._resolveStructInitializerTypeName`, both
 * reported as `1:0`, and one of them fired on valid code (#1277).
 *
 * ## One question, asked once
 *
 * A struct literal has no type of its own; the position it stands in supplies
 * one (`Point p <- { x: 1 }`). Where nothing does, nothing can say what struct
 * this is -- E0357. A bare `{ x: 1, y: 2 };` as an expression statement is the
 * only shape in the language that reaches it.
 *
 * ## E0356 is retired, with the syntax it rejected
 *
 * A second rule stood here: a WRITTEN type (`Point { x: 1 }`) where the
 * position already declared one was redundant. It had no reachable complement
 * -- every position that consumes a value declares a type, so the written form
 * was an error in all of them, and the one place it parsed was a bare
 * expression statement, where it built a compound literal and discarded it.
 * The grammar alternative is removed on the language owner's decision, which
 * makes `Point { x: 1 }` a parse error and leaves this rule with one question
 * rather than two.
 *
 * E0357's help therefore does not offer "write the type" as a remedy: there is
 * no type to write. The only remedy is to move the initializer somewhere a
 * type is declared.
 *
 * ## Why #1277 was a codegen bug and not this rule's business
 *
 * The "cannot infer" throw fired on three shapes that are perfectly valid:
 * `return { x: 1, y: 2 };` at file scope, the same inside a scope method, and
 * a `for` header's declaration. In each, a type WAS available and codegen
 * simply did not thread it -- the return path set an expected type only when
 * the return type was an enum, the `for` header set none at all, and the scope
 * method never recorded its return type. That is fixed at the three emission
 * sites, so the rule here sees a position that supplies a type and stays
 * silent. Relocating the throw without fixing them would have preserved a
 * rejection of valid code behind a fresh error code.
 *
 * The scope-method half was found by an invariant this card installed: a bare
 * enum member returned from a scope method reached `Internal:` rather than a
 * diagnostic, because 2.1 said the position established an enum type and
 * codegen disagreed. Two generators had open-coded the same four-step function
 * context and one was missing a line.
 */

import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";

import { CNextListener } from "../../transpiler/logic/parser/grammar/CNextListener";
import * as Parser from "../../transpiler/logic/parser/grammar/CNextParser";
import ParserUtils from "../../utils/ParserUtils";
import DeclarationScopeCollector from "./DeclarationScopeCollector";
import StructInitializerType from "./helpers/StructInitializerType";
import OperandTypeResolver from "./OperandTypeResolver";
import ScopeFrameResolver from "./ScopeFrameResolver";
import IStructLiteralError from "./types/IStructLiteralError";

class StructLiteralListener extends CNextListener {
  private readonly found: IStructLiteralError[] = [];

  public constructor(
    private readonly scopes: ScopeFrameResolver,
    private readonly operands: OperandTypeResolver,
  ) {
    super();
  }

  public errors(): IStructLiteralError[] {
    return this.found;
  }

  override enterStructInitializer = (
    ctx: Parser.StructInitializerContext,
  ): void => {
    // The STRUCTURAL question -- "does some enclosing position supply a type?"
    // -- and deliberately not "which type", which a C-header struct's field
    // cannot answer in this pass. See `hasEstablishingPosition`.
    if (StructInitializerType.hasEstablishingPosition(ctx)) return;

    this.report(
      ctx,
      "E0357",
      "Cannot infer struct type: nothing here says which struct this is",
      "Put the initializer where a type is declared -- a variable, an assignment target, a field, an argument, or a return (ADR-014).",
    );
  };

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

class StructLiteralAnalyzer {
  public analyze(tree: Parser.ProgramContext): IStructLiteralError[] {
    const declarations = new DeclarationScopeCollector();
    ParseTreeWalker.DEFAULT.walk(declarations, tree);
    const scopes = new ScopeFrameResolver(declarations);
    const listener = new StructLiteralListener(
      scopes,
      new OperandTypeResolver(scopes),
    );
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default StructLiteralAnalyzer;
