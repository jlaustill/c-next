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

import { ParserRuleContext, ParseTreeWalker, TerminalNode } from "antlr4ng";
import { CNextListener } from "../../PARSE/2-Parse/grammar/CNextListener";
import * as Parser from "../../PARSE/2-Parse/grammar/CNextParser";
import BUILTIN_TYPE_NAMES from "../../transpiler/constants/BUILTIN_TYPE_NAMES";
import ChainRoot from "./helpers/ChainRoot";
import DeclarationScopeCollector from "./DeclarationScopeCollector";
import ICodeGenSymbols from "../../transpiler/types/ICodeGenSymbols";
import IScopeFrame from "./types/IScopeFrame";
import IUndeclaredValueError from "./types/IUndeclaredValueError";
import NameExistence from "../../PARSE/3-Declare/NameExistence";
import ParserUtils from "../../utils/ParserUtils";
import REJECTED_KEYWORDS from "../../transpiler/constants/REJECTED_KEYWORDS";
import ScopeFrameResolver from "./ScopeFrameResolver";
import ScopeUtils from "../../utils/ScopeUtils";
import SymbolTable from "../../PARSE/3-Declare/SymbolTable";
import TChainRoot from "./types/TChainRoot";
import type IAnalysisContext from "./types/IAnalysisContext";

class UndeclaredValueListener extends CNextListener {
  private readonly analyzer: UndeclaredValueAnalyzer;

  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  private readonly scopes: ScopeFrameResolver;

  constructor(analyzer: UndeclaredValueAnalyzer, scopes: ScopeFrameResolver) {
    super();
    this.analyzer = analyzer;
    this.scopes = scopes;
  }

  /**
   * The READ position.
   *
   * ADR-016's three spellings read the chain from DIFFERENT offsets, which is
   * the whole of `ChainRoot`'s docstring: a bare name IS the primary, while
   * `this.x` and `global.x` put the keyword on the primary and the name in the
   * first op. Taking the name from the primary alone is why every rooted read
   * went unchecked -- `u32 v <- this.gx`, where `gx` is a file-scope global and
   * not a member of the enclosing scope, emitted `Scope__gx` at exit 0. That is
   * #1582's own defect one grammar rule over, and it is the case the write
   * position's fixture calls "the only witness to the split".
   */
  override enterPostfixExpression = (
    ctx: Parser.PostfixExpressionContext,
  ): void => {
    const primary = ctx.primaryExpression();
    if (!primary) {
      return;
    }

    const ops = ctx.postfixOp();
    const { root, identifier, opsConsumed } = ChainRoot.headOf(primary, ops);

    // `name(...)` is a call. E0422 owns undefined calls, with ADR-030/040/057
    // rules this analyzer deliberately does not reimplement. The root keyword
    // consumes the primary, so the parentheses sit `opsConsumed` further along
    // -- the offset travels with the root instead of being re-derived here.
    if (
      ops.length > opsConsumed &&
      ops[opsConsumed].getText().startsWith("(")
    ) {
      return;
    }

    this.check(identifier, root, ctx);
  };

  /**
   * The WRITE position. `assignmentTarget` is its own grammar rule, not a
   * `postfixExpression`, so no target ever reached the listener above and
   * `witness <- 5` against a name in no scope transpiled at exit 0 (#1582).
   *
   * One hook covers all three rules that reference the target -- the assignment
   * statement and a `for` loop's init and update clauses -- because they share
   * the node, not because the check is repeated for each.
   */
  override enterAssignmentTarget = (
    ctx: Parser.AssignmentTargetContext,
  ): void => {
    this.check(ctx.IDENTIFIER(), ChainRoot.ofTarget(ctx), ctx);
  };

  /**
   * One name, one question, for both positions.
   *
   * The two hooks differ only in how they read `(root, identifier)` off their
   * node -- the pair `ChainRoot` already separates. Everything after that is
   * the same policy, so it is written once: a second copy would be free to
   * gain an exempt spelling the other did not, which is the read/write
   * divergence #1582 is about.
   *
   * `identifier` is nullable because the read hook's primary may be a literal
   * or a parenthesised expression, and because the generated accessor for an
   * assignment target asserts non-null over a `getToken` that can return null.
   */
  private check(
    identifier: TerminalNode | null,
    root: TChainRoot,
    ctx: ParserRuleContext,
  ): void {
    if (!identifier) {
      return;
    }

    const name = identifier.getText();

    // ADR-026: `break`/`continue` parse as identifiers and are rejected by
    // E0703, which names the structured alternative. Reporting them as
    // undefined would be true and useless.
    //
    // That reasoning is the READ position's, and it does not carry to the
    // write position: E0703 is raised from `LoopAnalyzer`'s
    // `enterPrimaryExpression` alone, so `break <- 5` is exempted here and
    // owned by nothing -- it reaches the C compiler as `break = 5;`. The
    // exemption stays shared rather than being split, because narrowing it is
    // a diagnostic decision for the rule that owns those spellings; tracked as
    // #1632 with the reproduction.
    if (REJECTED_KEYWORDS.has(name) || BUILTIN_TYPE_NAMES.has(name)) {
      return;
    }

    const frame = this.scopes.frameFor(ctx);
    if (this.analyzer.isVisible(name, root, frame, this.scopes)) {
      return;
    }

    // The caret names the identifier, not the `this`/`global` keyword the
    // spelling may start with. `getPosition` takes the shape structurally, so
    // the terminal's own token is what carries the position here. For a bare
    // name this is the primary's own start token, so no position moves.
    const { line, column } = ParserUtils.getPosition({
      start: identifier.symbol,
    });
    this.analyzer.addError(name, line, column);
  }
}

class UndeclaredValueAnalyzer {
  private readonly errors: IUndeclaredValueError[] = [];

  /**
   * #1456: what the program declares, handed in rather than read off
   * `CodeGenState`. Constructor rather than a parameter on `analyze`, because
   * the predicates below are reached from the listener's walk.
   */
  constructor(private readonly context: IAnalysisContext) {}

  analyze(tree: Parser.ProgramContext): IUndeclaredValueError[] {
    this.errors.length = 0;

    // Same precondition as E0426, and the value axis needs it MORE: a `#define`
    // never reaches the symbol table at all, so `_isKnownForeignName` -- which
    // does catch a header typedef -- has nothing to fall back on for a macro.
    if (this.context.reachesForeignHeader) {
      return this.errors;
    }

    const declarations = new DeclarationScopeCollector();
    ParseTreeWalker.DEFAULT.walk(declarations, tree);

    ParseTreeWalker.DEFAULT.walk(
      new UndeclaredValueListener(
        this,
        new ScopeFrameResolver(declarations, this.context.symbolTable),
      ),
      tree,
    );
    return this.errors;
  }

  /**
   * Whether a name in a VALUE position denotes something this file can see.
   *
   * ADR-016's root is PART of the question, not a decoration on it: `this.x`
   * asks the enclosing scope, `global.x` asks file scope, and only a bare name
   * searches outward. `ScopeFrameResolver.declarationFor` is the one encoder of
   * that distinction over this file's lexical frames (#1322 found four copies
   * of it disagreeing, three of which emitted broken C at exit 0), so the root
   * is handed to it rather than re-branched. The arms below are the CROSS-FILE
   * half, which frames built from this file's parse tree cannot answer.
   *
   * Without the split, `this.gx` where `gx` is a file-scope global -- not a
   * member of the enclosing scope -- passes on the bare lookup and emits
   * `Scope__gx`, a name nothing declares.
   *
   * Both POSITIONS ask this identically, which is why there is one predicate
   * and not two. #1582 first gave the split to the write position alone, and
   * the read position beside it could not see a rooted name at all: `this.gx
   * <- 5` was rejected while `u32 v <- this.gx` on the next line emitted
   * `Scope__gx` at exit 0. Two predicates that agree by inspection are the
   * divergence this analyzer exists to prevent.
   */
  isVisible(
    name: string,
    root: TChainRoot,
    frame: IScopeFrame,
    scopes: ScopeFrameResolver,
  ): boolean {
    const symbols = this.context.symbols;

    if (root === null) {
      return (
        UndeclaredValueAnalyzer.isDeclaredValue(
          name,
          frame,
          frame.scopePath,
          scopes,
          this.context.symbolTable,
          this.context,
        ) || NameExistence.isKnownEnumMember(name, symbols)
      );
    }

    if (scopes.declarationFor(root, name, frame) !== null) {
      return true;
    }

    // `global.x` may still name a file-scope variable that arrived through an
    // `#include`, which this file's frames never held. The include-filtered
    // predicate is the cross-file half, exactly as it is for a bare name.
    if (root === "global") {
      return NameExistence.isValueName(name, symbols, this.context.symbolTable);
    }

    // `this.` outside any scope is E0431's to reject, and two diagnostics for
    // one name is worse than one.
    if (frame.scopePath === "") {
      return true;
    }

    return UndeclaredValueAnalyzer.isScopeMemberValue(
      name,
      frame.scopePath,
      symbols,
      this.context.symbolTable,
    );
  }

  /**
   * Whether a name is a value declared by the scope at `scopePath`.
   *
   * Written once because the bare spelling and the `this.` spelling ask it
   * identically -- the bare outward walk reaches the enclosing scope, and
   * `this.` names it directly. #1582 briefly carried two copies eighty lines
   * apart, which is the shape CLAUDE.md forbids: the single source of truth is
   * the DECISION, and the term `scopeMembers` is missing (it spans the run
   * rather than the include graph, #1494) has to be added in one place.
   */
  private static isScopeMemberValue(
    name: string,
    scopePath: string,
    symbols: ICodeGenSymbols,
    symbolTable: SymbolTable,
  ): boolean {
    return (
      NameExistence.isValueName(
        ScopeUtils.qualifyInScope(name, scopePath),
        symbols,
        symbolTable,
      ) ||
      (symbols.scopeMembers.get(scopePath)?.has(name) ?? false)
    );
  }

  /**
   * Whether a bare name denotes a DECLARED value -- a variable, parameter,
   * const, function, register or type name this file can see -- as distinct
   * from an enum MEMBER, which `isVisible` also admits.
   *
   * #1322: split out for E0424. An enum member written bare is a name this
   * file can see (so it is not undefined), but whether it may stand bare is a
   * question about its POSITION, and that rule must first know the name is not
   * a variable that merely shares the spelling. One predicate answers both
   * analyzers, so "declared" cannot mean two things.
   */
  static isDeclaredValue(
    name: string,
    frame: IScopeFrame,
    scopePath: string,
    scopes: ScopeFrameResolver,
    symbolTable: SymbolTable,
    context: IAnalysisContext,
  ): boolean {
    // A declared variable in an enclosing lexical frame of THIS file.
    //
    // #1398: deliberately the lexical half alone. The full `typeOfName` falls
    // back to the run-wide symbol table, which answers "declared anywhere in
    // this run" -- so a const declared in a sibling that this file never
    // included resolved here and returned visible, and E0427 could not fire
    // across a file boundary at all. The cross-file half of the question is
    // answered by `NameExistence.isValueName` below, whose `knownVariables`
    // term is include-filtered. The fallback itself stays for #1220's
    // essential-type analyzers, which want exactly the run-wide answer.
    if (scopes.typeOfNameLexical(name, frame) !== null) {
      return true;
    }

    const symbols = context.symbols;

    // A function referenced as a value (ADR-029 function-as-type), a type used
    // as the base of `Type.MEMBER`, a register, which is a value at an address
    // (ADR-004) and so answers here but NOT in the type position (#1336), and
    // -- since #1398 -- a file-scope variable or const from this file or a
    // `.cnx` it includes. That last term was briefly written here instead of in
    // the predicate, which left the module that owns "is this a visible value"
    // with the incomplete answer; see `isValueName`'s comment.
    // ADR-111: when a register becomes a type, `isValueName` loses the register
    // term. It does not collapse into `isTypeName` -- the variable term stays.
    //
    // #1430: `CodeGenState.knownFunctions` is deliberately NOT consulted, for
    // the reason `NameExistence`'s class comment already gives for
    // `callbackTypes`. Codegen fills it and `reset()` clears it, both after the
    // analyzers run, so at analysis time it is empty for the first file and
    // holds file N-1's function names for every file after. Because it is OR'd
    // toward "visible", a stale entry SUPPRESSED E0427: the same program with
    // its `#include` lines swapped either diagnosed the undefined name or
    // emitted C the compiler rejects at exit 0. It was redundant as well as
    // wrong -- `isValueName` reaches `symbols.functionReturnTypes`, the
    // per-file view of the same ADR-029 fact, on the identical key. The
    // qualified read below goes for the same reason, but on the key-shape
    // argument alone: reinstating it reddens no fixture.
    //
    // #1295 correction: that used to credit "the `scopeMembers` term beside it
    // already answers cross-file (#1494)", and `scopeMembers` does NOT cross a
    // file boundary -- `git grep -c scopeMembers -- VisibleSymbols.ts` is 0. It
    // is absent from the merge accumulator and survives only via the `...base`
    // spread, i.e. THIS file's symbols. `knownScopes` and
    // `scopeMemberVisibility`, written by the same `processScope`, ARE merged,
    // so the three disagree about what "visible" means. What actually answers
    // cross-file here is the run-wide `symbolTable` term below.
    if (NameExistence.isValueName(name, symbols, symbolTable)) {
      return true;
    }

    return (
      scopePath !== "" &&
      UndeclaredValueAnalyzer.isScopeMemberValue(
        name,
        scopePath,
        symbols,
        symbolTable,
      )
    );
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
