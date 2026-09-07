/**
 * ADR-016 scope access: E0435, E0436, E0437.
 *
 * #1322. Six throws in `output/` -- two in `ScopeResolver`, three in
 * `MemberAccessValidator`, one in `CodeGenerator` -- all reaching the user as
 * `1:0`, across eleven fixtures that assert that position.
 *
 * ## A duplicate the audit's table missed
 *
 * `ScopeResolver.validateCrossScopeVisibility` and
 * `MemberAccessValidator.validateNotSelfScopeReference` both rejected a scope's
 * own member reached through the scope's name, with the same message, decided
 * separately. The audit's duplicate-message table listed groups by throw text
 * and this pair escaped it because one of the two carried an `Error:` prefix.
 * They are one decision here.
 *
 * ## Three positions, one set of rules
 *
 * `Counter.value` can stand as an expression, as the target of an assignment,
 * and as a TYPE (`Internal.Secret s;` names a scope's struct). Codegen checked
 * each position on its own path -- the type position through
 * `TypeGenerationHelper`'s injected callback -- and the three had to be kept in
 * step by hand. Here each position only NAMES its scope and member; the rules
 * are asked once, in `check`.
 *
 * ## What each rule reads
 *
 * The enclosing scope is the lexical frame's `scopePath`; since ADR-016
 * rejects nested scopes (E0430) it is a single name. Visibility, membership and
 * the known enums, registers and scopes come from the per-file symbol view,
 * which is populated before this pass runs and already spans included files --
 * a private const in an included scope is rejected across the include, and two
 * fixtures assert it. A local variable shadowing a register is asked of the
 * frames.
 */

import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";

import { CNextListener } from "../../transpiler/logic/parser/grammar/CNextListener";
import * as Parser from "../../transpiler/logic/parser/grammar/CNextParser";
import CodeGenState from "../../transpiler/state/CodeGenState";
import ParserUtils from "../../utils/ParserUtils";
import ScopeUtils from "../../utils/ScopeUtils";
import DeclarationScopeCollector from "./DeclarationScopeCollector";
import IScopeAccessError from "./types/IScopeAccessError";
import IScopeFrame from "./types/IScopeFrame";
import ScopeFrameResolver from "./ScopeFrameResolver";

/** `Scope.member`, as written, with where it was written. */
interface IAccess {
  readonly scope: string;
  readonly member: string;
  readonly viaGlobal: boolean;
  readonly at: ParserRuleContext;
}

class ScopeAccessListener extends CNextListener {
  private readonly found: IScopeAccessError[] = [];

  public constructor(private readonly scopes: ScopeFrameResolver) {
    super();
  }

  public errors(): IScopeAccessError[] {
    return this.found;
  }

  // --- The three positions. Each only names the access. -------------------

  override enterPostfixExpression = (
    ctx: Parser.PostfixExpressionContext,
  ): void => {
    const primary = ctx.primaryExpression();
    const ops = ctx.postfixOp();
    if (!primary || ops.length === 0) return;
    if (primary.THIS()) return; // `this.` states the scope; nothing to resolve

    if (primary.GLOBAL()) {
      // `global.Scope.member`: the scope is the first op, the member the second.
      const scope = ScopeAccessListener.memberOf(ops[0]);
      const member = ScopeAccessListener.memberOf(ops[1]);
      if (scope && member)
        this.check({ scope, member, viaGlobal: true, at: ctx }, ctx);
      return;
    }
    const scope = primary.IDENTIFIER()?.getText();
    const member = ScopeAccessListener.memberOf(ops[0]);
    if (scope && member)
      this.check({ scope, member, viaGlobal: false, at: ctx }, ctx);
  };

  override enterAssignmentTarget = (
    ctx: Parser.AssignmentTargetContext,
  ): void => {
    // The grammar gives a target its own THIS/GLOBAL root: `global.S.m` is
    // GLOBAL + IDENTIFIER(S) + `.m`, and `this.m` states the scope outright.
    if (ctx.THIS() !== null) return;
    const member = ScopeAccessListener.memberOf(ctx.postfixTargetOp()[0]);
    if (member === null) return;
    const scope = ctx.IDENTIFIER().getText();
    this.check(
      { scope, member, viaGlobal: ctx.GLOBAL() !== null, at: ctx },
      ctx,
    );
  };

  override enterQualifiedType = (ctx: Parser.QualifiedTypeContext): void => {
    // A struct MEMBER's type was never visibility-checked by codegen: `S.onTick
    // handler;` with a private `onTick` compiles, and #1205's fixture depends
    // on it -- its whole point is the header prototype for that private
    // callback. Reproduced rather than closed; a variable's or parameter's
    // qualified type IS checked, as it was.
    if (ScopeAccessListener.insideStructMember(ctx)) return;
    const names = ctx.IDENTIFIER().map((id) => id.getText());
    if (names.length < 2) return;
    const viaGlobal = names[0] === "global";
    const [scope, member] = viaGlobal ? names.slice(1, 3) : names.slice(0, 2);
    if (scope && member) this.check({ scope, member, viaGlobal, at: ctx }, ctx);
  };

  private static insideStructMember(node: ParserRuleContext): boolean {
    let cursor: ParserRuleContext | null = node.parent;
    while (cursor) {
      if (cursor instanceof Parser.StructMemberContext) return true;
      cursor = cursor.parent;
    }
    return false;
  }

  /**
   * The member a `.name` op names, or null for a subscript, a call, or no op.
   *
   * An optional-chained `DOT()` compared to null is TRUE for a MISSING op, and
   * the `.IDENTIFIER()` that followed then ran on undefined -- every `global.x`
   * with a single member crashed, and sixteen fixtures failed with an internal
   * error before this was one guarded helper.
   */
  private static memberOf(
    op: Parser.PostfixOpContext | Parser.PostfixTargetOpContext | undefined,
  ): string | null {
    if (op === undefined || op.DOT() === null) return null;
    return op.IDENTIFIER()?.getText() ?? null;
  }

  // --- The rules, asked once ------------------------------------------------

  private check(access: IAccess, node: ParserRuleContext): void {
    // A register declared inside a scope is owned by the register rules, not
    // these: `Board.GPIO.DR_SET[3] <- true;` inside `Board` compiles, and so
    // does `Board.GPIO.DR[0] <- true;` from `main`, private or not. Codegen's
    // register path exempted it ("a scoped register -- allow bare access")
    // before any of the three checks here could run, so it is exempt from all
    // three. `scopedRegisters` is keyed by the transpiled C name, so the key
    // goes through the single encoder rather than being spelled by hand.
    if (ScopeAccessListener.isScopedRegister(access)) return;

    const frame = this.scopes.frameFor(node);
    const here = frame.scopePath;

    if (this.reportOwnScope(access, here)) return;
    if (this.reportPrivate(access, here)) return;
    this.reportShadowedGlobal(access, here, frame);
  }

  /** E0435: `Counter.value` inside `Counter`. `global.Counter.value` is allowed. */
  private reportOwnScope(access: IAccess, here: string): boolean {
    if (access.viaGlobal || here === "" || access.scope !== here) return false;
    this.report(
      access.at,
      "E0435",
      `Cannot reference own scope '${access.scope}' by name; use 'this.${access.member}' instead of '${access.scope}.${access.member}'`,
      "Inside a scope its members are reached through `this.`; the scope's name is for the outside. `global.` is allowed when the qualification is deliberate.",
    );
    return true;
  }

  /** E0436: a private member reached from another scope or from file scope. */
  private reportPrivate(access: IAccess, here: string): boolean {
    if (!CodeGenState.symbols?.knownScopes.has(access.scope)) return false;
    if (access.scope === here) return false;
    const visibility = CodeGenState.symbols.scopeMemberVisibility
      .get(access.scope)
      ?.get(access.member);
    if (visibility !== "private") return false;
    const context =
      here === "" ? "from outside the scope" : `from scope '${here}'`;
    this.report(
      access.at,
      "E0436",
      `Cannot access private member '${access.member}' of scope '${access.scope}' ${context}`,
      "Only public members are accessible outside their scope. Mark it `public`, or reach it through a public member.",
    );
    return true;
  }

  /**
   * E0437: inside a scope, a global enum or register whose name a scope member
   * -- or, for a register, a local variable -- shadows must be written with
   * `global.`. Bare, the name would resolve to the shadow and generate C that
   * names the wrong thing.
   */
  private reportShadowedGlobal(
    access: IAccess,
    here: string,
    frame: IScopeFrame,
  ): void {
    if (access.viaGlobal || here === "") return;
    const symbols = CodeGenState.symbols;
    if (!symbols) return;

    const isEnum = symbols.knownEnums.has(access.scope);
    const isRegister = symbols.knownRegisters.has(access.scope);
    if (!isEnum && !isRegister) return;

    const shadowedByMember =
      symbols.scopeMembers.get(here)?.has(access.scope) ?? false;
    const shadowedByLocal =
      isRegister &&
      this.scopes.declarationOfNameLexical(access.scope, frame) !== null;
    if (!shadowedByMember && !shadowedByLocal) return;

    const kind = isEnum ? "enum" : "register";
    const why = shadowedByMember
      ? `scope member '${access.scope}' shadows the global ${kind}`
      : `a local variable named '${access.scope}' shadows the global ${kind}`;
    this.report(
      access.at,
      "E0437",
      `Use 'global.${access.scope}.${access.member}' to access ${kind} '${access.scope}' from inside scope '${here}' (${why})`,
      "A bare name resolves to the nearest declaration, which here is the shadow. `global.` names the file-scope one unambiguously.",
    );
  }

  private static isScopedRegister(access: IAccess): boolean {
    const cName = ScopeUtils.getTranspiledCName({
      scopePath: access.scope,
      name: access.member,
    });
    return CodeGenState.symbols?.scopedRegisters?.has(cName) ?? false;
  }

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

class ScopeAccessAnalyzer {
  public analyze(tree: Parser.ProgramContext): IScopeAccessError[] {
    const declarations = new DeclarationScopeCollector();
    ParseTreeWalker.DEFAULT.walk(declarations, tree);

    const listener = new ScopeAccessListener(
      new ScopeFrameResolver(declarations),
    );
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default ScopeAccessAnalyzer;
