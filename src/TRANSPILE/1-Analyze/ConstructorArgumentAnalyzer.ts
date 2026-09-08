/**
 * A C++ constructor argument must name a declared `const` variable.
 *
 * #1322. The rule was two throws with identical text -- `VariableDeclHelper`
 * for a file-scope declaration, `ScopeGenerator` for one inside a `scope` --
 * and, more to the point, TWO WAYS of deciding const-ness. One read
 * `CodeGenState.getVariableTypeInfo`, falling back to a scope-qualified name
 * built by hand; the other went through `orchestrator.isConstValue` on a name
 * qualified by a different helper. They agreed by construction only for as long
 * as nobody edited one of them, which is the shape CLAUDE.md calls the worst
 * anti-pattern: the same decision derived twice.
 *
 * Here it is one question -- what does this name's declaration say? -- asked of
 * the lexical frames, which already handle a scope member and a file-scope
 * variable the same way, with shadowing.
 *
 * It moves on `IDeclaredVar.isConst`, added for exactly this: the collector
 * reads `constModifier` at every declaration site, so 2.1 answers without any
 * codegen state.
 *
 * Both diagnostics of the family move together. "is not declared" was thrown
 * from the same loop one step earlier, and splitting them would leave a rule
 * half in each pass.
 */

import { ParseTreeWalker } from "antlr4ng";

import { CNextListener } from "../../transpiler/logic/parser/grammar/CNextListener";
import * as Parser from "../../transpiler/logic/parser/grammar/CNextParser";
import ParserUtils from "../../utils/ParserUtils";
import DeclarationScopeCollector from "./DeclarationScopeCollector";
import ScopeFrameResolver from "./ScopeFrameResolver";
import IConstructorArgumentError from "./types/IConstructorArgumentError";

class ConstructorArgumentListener extends CNextListener {
  private readonly found: IConstructorArgumentError[] = [];

  public constructor(private readonly scopes: ScopeFrameResolver) {
    super();
  }

  public errors(): IConstructorArgumentError[] {
    return this.found;
  }

  override enterVariableDeclaration = (
    ctx: Parser.VariableDeclarationContext,
  ): void => {
    const args = ctx.constructorArgumentList();
    if (!args) return;

    for (const identifier of args.IDENTIFIER()) {
      const name = identifier.getText();
      const { line, column } = ParserUtils.getPosition(ctx);
      const declared = this.scopes.declarationOfNameLexical(
        name,
        this.scopes.frameFor(ctx),
      );

      if (!declared) {
        this.found.push({
          code: "E0433",
          line,
          column,
          message: `Constructor argument '${name}' is not declared`,
          helpText: `Declare '${name}' as a const before the constructor, or pass a literal.`,
        });
        continue;
      }
      if (!declared.isConst) {
        this.found.push({
          code: "E0432",
          line,
          column,
          message: `Constructor argument '${name}' must be const`,
          helpText:
            "A C++ constructor runs during static initialization, before main, so it may only read a value fixed at compile time. Declare the argument `const`.",
        });
      }
    }
  };
}

class ConstructorArgumentAnalyzer {
  public analyze(tree: Parser.ProgramContext): IConstructorArgumentError[] {
    const declarations = new DeclarationScopeCollector();
    ParseTreeWalker.DEFAULT.walk(declarations, tree);

    const listener = new ConstructorArgumentListener(
      new ScopeFrameResolver(declarations),
    );
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default ConstructorArgumentAnalyzer;
