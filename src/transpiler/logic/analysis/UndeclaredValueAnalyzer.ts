/**
 * UndeclaredValueAnalyzer — rejects a bare identifier in a value position that
 * denotes nothing this file can see (E0427).
 *
 * Issue #1353. `#985` closed this hole for a CALL (`E0422`); the value
 * reference was never covered, so `u32 v <- notDeclaredAnywhere;` exited 0 and
 * emitted `uint32_t v = notDeclaredAnywhere;`. The cause is the same shape as
 * #1312's: `TypeValidator.resolveBareIdentifier` returns `string | null` where
 * `null` means BOTH "emit it unchanged, it is fine" (a local needing no rename,
 * or a known global at file scope) and "no idea what this is", so no caller can
 * tell a resolved name from an unresolved one.
 *
 * Three positions can hold an undeclared name and they are one question asked
 * three ways -- "is this name visible here, as kind K?":
 *
 *   | position | owner                              |
 *   | -------- | ---------------------------------- |
 *   | call     | `FunctionCallAnalyzer` (E0422)     |
 *   | type     | `UndeclaredTypeAnalyzer` (E0426)   |
 *   | value    | this analyzer (E0427)              |
 *
 * The shared half is the lookup, not the policy: existence goes through
 * `NameExistence` and `ScopeFrameResolver`, while each position keeps its own
 * rules. E0422's are substantial and specific to calls -- ADR-030 ordering,
 * ADR-040 callable variables, ADR-057 implicit scope calls, stdlib header
 * hints -- and folding them in here would delete working behavior across ten
 * fixtures rather than remove a duplicate decision.
 *
 * A call target is therefore skipped outright: E0422 already owns it, and two
 * diagnostics for one name is worse than one.
 */

import { ParseTreeWalker } from "antlr4ng";
import { CNextListener } from "../parser/grammar/CNextListener";
import * as Parser from "../parser/grammar/CNextParser";
import BUILTIN_TYPE_NAMES from "../../constants/BUILTIN_TYPE_NAMES";
import CodeGenState from "../../state/CodeGenState";
import DeclarationScopeCollector from "./DeclarationScopeCollector";
import EnclosingScope from "./helpers/EnclosingScope";
import IUndeclaredValueError from "./types/IUndeclaredValueError";
import NameExistence from "../symbols/NameExistence";
import ParserUtils from "../../../utils/ParserUtils";
import REJECTED_KEYWORDS from "../../constants/REJECTED_KEYWORDS";
import ScopeFrameResolver from "./ScopeFrameResolver";
import ScopeUtils from "../../../utils/ScopeUtils";

class UndeclaredValueListener extends CNextListener {
  private readonly analyzer: UndeclaredValueAnalyzer;

  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  private readonly scopes: ScopeFrameResolver;

  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  private readonly enclosing = new EnclosingScope();

  constructor(analyzer: UndeclaredValueAnalyzer, scopes: ScopeFrameResolver) {
    super();
    this.analyzer = analyzer;
    this.scopes = scopes;
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

  override enterPostfixExpression = (
    ctx: Parser.PostfixExpressionContext,
  ): void => {
    const primary = ctx.primaryExpression();
    const identifier = primary?.IDENTIFIER();
    if (!identifier) {
      return;
    }

    // `name(...)` is a call. E0422 owns undefined calls, with ADR-030/040/057
    // rules this analyzer deliberately does not reimplement.
    const ops = ctx.postfixOp();
    if (ops.length > 0 && ops[0].getText().startsWith("(")) {
      return;
    }

    const name = identifier.getText();

    // ADR-026: `break`/`continue` parse as identifiers and are rejected by
    // E0703, which names the structured alternative. Reporting them as
    // undefined would be true and useless.
    if (REJECTED_KEYWORDS.has(name) || BUILTIN_TYPE_NAMES.has(name)) {
      return;
    }

    if (
      this.analyzer.isVisible(
        name,
        this.scopes.frameFor(ctx),
        this.enclosing.current(),
        this.scopes,
      )
    ) {
      return;
    }

    const { line, column } = ParserUtils.getPosition(primary);
    this.analyzer.addError(name, line, column);
  };
}

class UndeclaredValueAnalyzer {
  private readonly errors: IUndeclaredValueError[] = [];

  analyze(tree: Parser.ProgramContext): IUndeclaredValueError[] {
    this.errors.length = 0;

    // Same precondition as E0426, and the value axis needs it MORE: a `#define`
    // never reaches the symbol table at all, so `_isKnownForeignName` -- which
    // does catch a header typedef -- has nothing to fall back on for a macro.
    if (CodeGenState.currentFileReachesForeignHeader) {
      return this.errors;
    }

    const declarations = new DeclarationScopeCollector();
    ParseTreeWalker.DEFAULT.walk(declarations, tree);

    ParseTreeWalker.DEFAULT.walk(
      new UndeclaredValueListener(this, new ScopeFrameResolver(declarations)),
      tree,
    );
    return this.errors;
  }

  isVisible(
    name: string,
    frame: Parameters<ScopeFrameResolver["typeOfName"]>[1],
    scope: ReturnType<EnclosingScope["current"]>,
    scopes: ScopeFrameResolver,
  ): boolean {
    // A declared variable -- lexical frames first, then the symbol table for a
    // declaration that arrived through a .cnx include (#1220).
    if (scopes.typeOfName(name, frame) !== null) {
      return true;
    }

    const symbols = CodeGenState.symbols;
    if (!symbols) {
      return true;
    }

    // A function referenced as a value (ADR-029 function-as-type), a type used
    // as the base of `Type.MEMBER`, and a register, which is a value at an
    // address (ADR-004) and so answers here but NOT in the type position
    // (#1336). ADR-111: when a register becomes a type, `isValueName` collapses
    // into `isTypeName` and both call sites below revert to it.
    const symbolTable = CodeGenState.symbolTable;
    if (
      NameExistence.isValueName(name, symbols, symbolTable) ||
      NameExistence.isKnownEnumMember(name, symbols) ||
      CodeGenState.knownFunctions.has(name)
    ) {
      return true;
    }

    if (scope) {
      const qualified = ScopeUtils.qualifyInScope(name, scope);
      if (
        NameExistence.isValueName(qualified, symbols, symbolTable) ||
        CodeGenState.knownFunctions.has(qualified) ||
        (symbols.scopeMembers.get(scope.name)?.has(name) ?? false)
      ) {
        return true;
      }
    }

    return false;
  }

  addError(identifier: string, line: number, column: number): void {
    this.errors.push({
      code: "E0427",
      identifier,
      line,
      column,
      message: `'${identifier}' is not defined`,
    });
  }
}

export default UndeclaredValueAnalyzer;
