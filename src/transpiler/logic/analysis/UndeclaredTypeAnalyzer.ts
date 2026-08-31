/**
 * UndeclaredTypeAnalyzer — rejects a type name that denotes nothing this file
 * can see (E0426).
 *
 * Issue #1312. `CodeGenerator.getTypeName` ends in `resolved ?? ctx.getText()`,
 * so a name that resolves to no type was emitted as the raw C-Next source text
 * and the run exited 0. `Mode borrowedFromSibling <- Mode.MODE_A;` produced
 * `Mode borrowedFromSibling = Mode.MODE_A;`, which gcc rejects with
 * "unknown type name 'Mode'". The report framed this as a cross-file sibling
 * defect; measured on 0b0bd133 a lone file with no includes anywhere in the run
 * behaves identically, so the hole is the type position itself.
 *
 * ## Why an analyzer and not codegen
 *
 * Codegen-thrown errors report the synthetic position `1:0` -- 129 of 282
 * `.expected.error` fixtures begin that way (#1316's measurement, tracked as
 * #1184/#1318). #1312 asks for the type to be named *at its use site*, which
 * only a pass holding the parse tree can do. Analyzers already run with
 * `CodeGenState.symbols` populated (`Transpiler.ts:509`), so the position and
 * the symbol view are available in the same place.
 *
 * ## Why `enterUserType` and not a list of type positions
 *
 * A type appears in variable declarations, parameters, struct fields, return
 * types and for-init declarations. Enumerating them is the shape that leaves a
 * hole -- the project has been bitten by rules enforced in one context and
 * silently absent in another (#1219). `userType` is the single grammar rule for
 * a bare named type, so hooking it covers every position by construction, and a
 * new type position added to the grammar is covered without anyone remembering
 * to update this file.
 *
 * `this.T`, `global.T` and `Scope.T` are separate grammar branches that state
 * their scope outright; they are not `userType` and are deliberately not
 * checked here.
 */

import { ParseTreeWalker } from "antlr4ng";
import { CNextListener } from "../parser/grammar/CNextListener";
import * as Parser from "../parser/grammar/CNextParser";
import BUILTIN_TYPE_NAMES from "../../constants/BUILTIN_TYPE_NAMES";
import CodeGenState from "../../state/CodeGenState";
import EnclosingScope from "./helpers/EnclosingScope";
import IUndeclaredTypeError from "./types/IUndeclaredTypeError";
import NameExistence from "../symbols/NameExistence";
import ParserUtils from "../../../utils/ParserUtils";
import ScopeUtils from "../../../utils/ScopeUtils";

class UndeclaredTypeListener extends CNextListener {
  private readonly analyzer: UndeclaredTypeAnalyzer;

  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  private readonly enclosing = new EnclosingScope();

  constructor(analyzer: UndeclaredTypeAnalyzer) {
    super();
    this.analyzer = analyzer;
  }

  private static _isSizeofOperand(ctx: Parser.UserTypeContext): boolean {
    for (
      let node: Parser.UserTypeContext["parent"] = ctx.parent;
      node;
      node = node.parent
    ) {
      if (node instanceof Parser.SizeofExpressionContext) {
        return true;
      }
    }
    return false;
  }

  override enterScopeDeclaration = (
    ctx: Parser.ScopeDeclarationContext,
  ): void => {
    this.enclosing.enter(ctx.IDENTIFIER().getText());
  };

  override exitScopeDeclaration = (
    _ctx: Parser.ScopeDeclarationContext,
  ): void => {
    this.enclosing.exit();
  };

  override enterUserType = (ctx: Parser.UserTypeContext): void => {
    const typeName = ctx.IDENTIFIER().getText();
    if (BUILTIN_TYPE_NAMES.has(typeName)) {
      return;
    }

    // ADR-023: `sizeof ( type | expression )`. The two alternatives are
    // ambiguous for a bare identifier and ANTLR takes the `type` branch, so
    // `sizeof(myArray)` arrives here as a `userType` naming a VARIABLE. The
    // operand is genuinely undecidable from the grammar alone, so this is the
    // one position where an unknown name is not evidence of a missing type.
    if (UndeclaredTypeListener._isSizeofOperand(ctx)) {
      return;
    }

    if (this.analyzer.isVisibleType(typeName, this.enclosing.current())) {
      return;
    }

    const { line, column } = ParserUtils.getPosition(ctx);
    this.analyzer.addError(typeName, line, column);
  };
}

class UndeclaredTypeAnalyzer {
  private readonly errors: IUndeclaredTypeError[] = [];

  analyze(tree: Parser.ProgramContext): IUndeclaredTypeError[] {
    this.errors.length = 0;

    // Only diagnose where the transpiler actually knows the whole name
    // universe of the file. A C/C++ header is not parsed into the symbol table
    // -- `FILE` from <stdio.h> is the standing example -- so an unresolved name
    // in a file that can see one is indistinguishable from a type the compiler
    // will supply, and emitting it verbatim is the CORRECT behavior for C
    // interop (#985 external-symbol recovery).
    //
    // Rejecting valid interop code is a regression; failing to diagnose is the
    // status quo, so this declines rather than guesses.
    //
    // #1399 review: the answer is computed during discovery from the
    // resolver's own categorization and is TRANSITIVE. An earlier version
    // walked this file's own `#include` token text, which made a third
    // spelling of "is this a C-Next include?" (it missed `.cnext`) and stopped
    // at one hop -- so a macro reached through a `.cnx` include was REJECTED,
    // code that main compiles.
    if (CodeGenState.currentFileReachesForeignHeader) {
      return this.errors;
    }

    ParseTreeWalker.DEFAULT.walk(new UndeclaredTypeListener(this), tree);
    return this.errors;
  }

  /**
   * ADR-057: inside a scope a bare `T` may name a scope-declared type, which is
   * recorded under its qualified name. The bare spelling is still accepted,
   * because a scope may also reference a global type.
   */
  isVisibleType(
    typeName: string,
    scope: ReturnType<EnclosingScope["current"]>,
  ): boolean {
    const symbols = CodeGenState.symbols;
    if (!symbols) {
      // Nothing to check against; stay silent rather than reject on no evidence.
      return true;
    }

    const symbolTable = CodeGenState.symbolTable;

    if (scope) {
      const qualified = ScopeUtils.qualifyInScope(typeName, scope);
      if (NameExistence.isKnownType(qualified, symbols, symbolTable)) {
        return true;
      }
    }

    return NameExistence.isKnownType(typeName, symbols, symbolTable);
  }

  addError(typeName: string, line: number, column: number): void {
    this.errors.push({
      code: "E0426",
      typeName,
      line,
      column,
      message: `type '${typeName}' is not defined`,
    });
  }
}

export default UndeclaredTypeAnalyzer;
