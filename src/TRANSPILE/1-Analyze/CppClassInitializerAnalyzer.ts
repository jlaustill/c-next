/**
 * Issue #517 / ADR-014: a C++ class initializer with nowhere to put its
 * assignments -- E0508.
 *
 * #1322. One throw in `VariableDeclHelper.finalizeCppClassAssignments`,
 * reported as `1:0`.
 *
 * ## The throw was at the drain, not at the offender, and that is a defect
 *
 * A C++ class is not an aggregate, so `{ value: 42 }` cannot be a designated
 * initializer; codegen lowers it to `obj.value = 42;` and pushes those onto
 * `CodeGenState.pendingCppClassAssignments` from inside the initializer, then
 * drains the queue at the NEXT variable declaration it finalizes. Those are
 * different nodes, and the gap between them is observable:
 *
 * - a scope member's initializer pushes and is never drained, so
 *   `private CppTestClass inner <- { value: 5 }` emitted
 *   `static CppTestClass Holder__inner = {};` at exit 0 -- the value silently
 *   dropped, no diagnostic;
 * - with an unrelated global after it, the drain fires against THAT
 *   declaration and reports `C++ class 'u32' with constructor cannot use
 *   struct initializer syntax` -- naming a type with no constructor, three
 *   lines from the initializer that caused it.
 *
 * So this rule is not a transcription of codegen's guard. It is authored at
 * the STRUCT INITIALIZER, which is the node that is wrong, and it asks two
 * questions of that node: does a function body enclose it, and is the type it
 * builds a C++ class with a constructor?
 *
 * The first question also closes the scope-member hole above: a scope member
 * is emitted as a file-scope `static`, so it has no more statement position
 * than a global does.
 *
 * ## What it may read
 *
 * `cppMode` is handed in from `Transpiler`, never read from `CodeGenState`,
 * whose copy is written inside `CodeGenerator.generate()` -- measured `false`
 * for a run's first file and the PREVIOUS file's value afterwards. The symbol
 * table is filled in stage 2 and is correct here; `CppConstructorHelper` was
 * moved to `src/utils/` because asking it is a symbol-model question, and 2.1
 * may not import `output/`.
 */

import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";

import { CNextListener } from "../../transpiler/logic/parser/grammar/CNextListener";
import * as Parser from "../../transpiler/logic/parser/grammar/CNextParser";
import SymbolTable from "../../transpiler/logic/symbols/SymbolTable";
import CppConstructorHelper from "../../utils/CppConstructorHelper";
import ParserUtils from "../../utils/ParserUtils";
import DeclarationScopeCollector from "./DeclarationScopeCollector";
import FunctionReference from "./helpers/FunctionReference";
import StructInitializerType from "./helpers/StructInitializerType";
import OperandTypeResolver from "./OperandTypeResolver";
import ICppClassInitializerError from "./types/ICppClassInitializerError";
import ScopeFrameResolver from "./ScopeFrameResolver";

class CppClassInitializerListener extends CNextListener {
  private readonly found: ICppClassInitializerError[] = [];

  public constructor(
    private readonly scopes: ScopeFrameResolver,
    private readonly operands: OperandTypeResolver,
    private readonly symbolTable: SymbolTable,
  ) {
    super();
  }

  public errors(): ICppClassInitializerError[] {
    return this.found;
  }

  override enterStructInitializer = (
    ctx: Parser.StructInitializerContext,
  ): void => {
    if (CppClassInitializerListener.insideFunctionBody(ctx)) return;

    const frame = this.scopes.frameFor(ctx);
    const typeText = StructInitializerType.establishedTypeText(
      ctx,
      frame,
      this.operands,
    );
    if (typeText === null) return; // E0357's to report

    const cppClass = this.cppClassWithConstructor(typeText, frame.scopePath);
    if (cppClass === null) return;

    const { line, column } = ParserUtils.getPosition(ctx);
    this.found.push({
      code: "E0508",
      line,
      column,
      message: `C++ class '${cppClass}' has a constructor, so struct initializer syntax cannot be used outside a function body`,
      helpText:
        "A class with a constructor is not an aggregate, so the fields are assigned one at a time -- and a declaration outside a function body has no statement to assign them in. Initialize it inside a function, or use constructor syntax.",
    });
  };

  /**
   * The C++ name of the class this type text denotes, when it has a
   * constructor. Null for anything else, including a plain aggregate.
   *
   * The text in hand is the SOURCE spelling: `TestNS.MyClass`, which the symbol
   * table does not hold. `candidatesForTypeText` is the same ADR-057 mapping
   * every other rule here uses, and it produces `TestNS__MyClass`, which
   * `CppConstructorHelper` re-spells as `TestNS::MyClass` to look up.
   */
  private cppClassWithConstructor(
    typeText: string,
    scopePath: string,
  ): string | null {
    for (const candidate of FunctionReference.candidatesForTypeText(
      typeText,
      scopePath,
    )) {
      if (CppConstructorHelper.hasConstructor(candidate, this.symbolTable)) {
        return CppConstructorHelper.toQualifiedName(candidate);
      }
    }
    return null;
  }

  /**
   * Whether a function body encloses this node.
   *
   * A scope METHOD counts -- it becomes a function. A scope MEMBER does not:
   * it is emitted as a file-scope `static`, so it has no more room for a
   * statement than a global does, which is the hole codegen's check had.
   */
  private static insideFunctionBody(ctx: ParserRuleContext): boolean {
    let cursor: ParserRuleContext | null = ctx.parent;
    while (cursor) {
      if (cursor instanceof Parser.FunctionDeclarationContext) return true;
      cursor = cursor.parent;
    }
    return false;
  }
}

class CppClassInitializerAnalyzer {
  public analyze(
    tree: Parser.ProgramContext,
    cppMode: boolean,
    symbolTable: SymbolTable,
  ): ICppClassInitializerError[] {
    // C mode never emits a C++ class: a `.hpp` include in a C run is E0507,
    // reported before this pass, so there is nothing here to decide.
    if (!cppMode) return [];

    const declarations = new DeclarationScopeCollector();
    ParseTreeWalker.DEFAULT.walk(declarations, tree);
    const scopes = new ScopeFrameResolver(declarations);

    const listener = new CppClassInitializerListener(
      scopes,
      new OperandTypeResolver(scopes),
      symbolTable,
    );
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default CppClassInitializerAnalyzer;
