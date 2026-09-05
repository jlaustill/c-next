/**
 * UndeclaredTypeAnalyzer — rejects a name in a type position that does not name
 * a type: one that denotes nothing this file can see (E0426), or one that
 * denotes a register, which is not a type (E0429, #1336).
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
import ICodeGenSymbols from "../../types/ICodeGenSymbols";
import IUndeclaredTypeError from "./types/IUndeclaredTypeError";
import NameExistence from "../../../PARSE/3-Declare/NameExistence";
import SymbolTable from "../symbols/SymbolTable";
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

    const scope = this.enclosing.current();
    if (this.analyzer.isVisibleType(typeName, scope)) {
      return;
    }

    const { line, column } = ParserUtils.getPosition(ctx);

    // A register IS declared -- just not as a type. Reporting "not defined" of
    // a name declared a few lines up reads as a transpiler fault rather than a
    // mistake in the source, so name what it actually is (#1336).
    if (this.analyzer.isRegister(typeName, scope)) {
      this.analyzer.addRegisterInTypePositionError(typeName, line, column);
      return;
    }

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
      // This is the ONLY answer to "no symbol view" in this class: `isRegister`
      // runs only after this returned false, which cannot happen when `symbols`
      // is null, so a second guard there would be unreachable AND would answer
      // the opposite way.
      return true;
    }

    return UndeclaredTypeAnalyzer._eitherSpelling(
      typeName,
      scope,
      symbols,
      (name, fileSymbols, symbolTable) =>
        NameExistence.isTypeName(name, fileSymbols, symbolTable),
    );
  }

  /**
   * Whether the name denotes a register (ADR-004). Asked only after
   * `isVisibleType` has already answered no, to tell E0429 from E0426.
   *
   * Cross-file this answers no, and the name falls through to E0426. That is
   * currently TRUE rather than a gap: a register declared in an included file is
   * not visible in the consumer at all (#1453 -- its `#define` is written to the
   * implementation file and the header exports nothing), so "not defined" is the
   * accurate report. When #1453 makes such a register visible it lands in the
   * same `knownRegisters` set this reads, and E0429 begins firing there with no
   * change here.
   *
   * ADR-111: retire this with E0429 when a register becomes a type -- at which
   * point `isVisibleType` answers yes and this is never reached.
   */
  isRegister(
    typeName: string,
    scope: ReturnType<EnclosingScope["current"]>,
  ): boolean {
    return UndeclaredTypeAnalyzer._eitherSpelling(
      typeName,
      scope,
      // Reached only after `isVisibleType` returned false, which requires a
      // symbol view -- see its guard.
      CodeGenState.symbols!,
      (name, fileSymbols) => NameExistence.isRegisterName(name, fileSymbols),
    );
  }

  /**
   * ADR-057: inside a scope a bare `T` may name a scope-declared type, recorded
   * under its qualified name. The bare spelling stays acceptable because a
   * scope may also reference a global type.
   *
   * Both questions must accept the SAME pair of spellings. A scoped register
   * that only the qualified spelling finds would otherwise fail the type test
   * and then fail the register test too, and be reported as undefined rather
   * than as a register -- so the walk lives here once and is asked twice.
   */
  private static _eitherSpelling(
    typeName: string,
    scope: ReturnType<EnclosingScope["current"]>,
    symbols: ICodeGenSymbols,
    test: (
      name: string,
      symbols: ICodeGenSymbols,
      symbolTable: SymbolTable,
    ) => boolean,
  ): boolean {
    const symbolTable = CodeGenState.symbolTable;

    if (scope) {
      const qualified = ScopeUtils.qualifyInScope(typeName, scope);
      if (test(qualified, symbols, symbolTable)) {
        return true;
      }
    }

    return test(typeName, symbols, symbolTable);
  }

  addError(typeName: string, line: number, column: number): void {
    this._push(
      "E0426",
      typeName,
      line,
      column,
      `type '${typeName}' is not defined`,
    );
  }

  /**
   * E0429: the name is declared, but as a register, and a register is not a
   * type (ADR-004).
   *
   * ADR-111: this code exists only for as long as that is true. When ADR-111 is
   * IMPLEMENTED, `Control c;` becomes the instantiation form it designs and
   * this diagnostic is retired outright -- delete the method, its call site,
   * `NameExistence.isRegisterName`, the fixture, and the E0429 registry row.
   */
  addRegisterInTypePositionError(
    typeName: string,
    line: number,
    column: number,
  ): void {
    this._push(
      "E0429",
      typeName,
      line,
      column,
      `'${typeName}' is a register, not a type`,
    );
  }

  private _push(
    code: string,
    typeName: string,
    line: number,
    column: number,
    message: string,
  ): void {
    this.errors.push({ code, typeName, line, column, message });
  }
}

export default UndeclaredTypeAnalyzer;
