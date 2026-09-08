/**
 * ADR-004 register access modifiers: E0870, E0871, E0872.
 *
 * #1322. Four throws in `output/` -- `MemberAccessValidator` for a read of a
 * `wo` member, `AssignmentValidator` for a write to an `ro` member, and two in
 * `AssignmentHandlerUtils` for a zero assigned to a write-1 bit -- reaching the
 * user as `1:0`, across three fixtures that assert that position.
 *
 * ## One chain reader, five spellings
 *
 * A register member is reached as `R.M`, `this.R.M`, `global.R.M`, `S.R.M`
 * or `global.S.R.M`. Codegen resolved that chain separately on the read path
 * (`PostfixExpressionGenerator`), the whole-member write path
 * (`AssignmentValidator`, which keyed on the FIRST two identifiers) and the bit
 * write path (`RegisterHandlers`, which prefixed the scope). The three
 * disagreed, and the gaps were holes -- all probed before this existed:
 *
 * - `this.R.ST <- 1`, `Board.R.ST <- 1` from `main`, `global.Board.R.ST <- 1`
 *   and `this.R.ST[3] <- true` on an `ro` member of a SCOPED register were
 *   accepted. The emitted C assigns through a `volatile uint32_t const *`
 *   macro, which the C compiler rejects; C-Next said nothing.
 * - `R.SET +<- 1` on a `wo` member was accepted and emitted `R__SET += 1`,
 *   a read of a write-only register. A compound operator reads its target.
 * - `R.SET[3] <- 0x0`, `<- 0b0`, `<- 00` and `<- OFF` with `const u32 OFF <- 0`
 *   were accepted and emitted `R__SET = (1U << 3)` -- the zero the author wrote
 *   to clear a bit SET it, because the check compared the generated text
 *   against the two spellings `"false"` and `"0"`.
 *
 * Here the chain is resolved once, to the member's key in the per-file symbol
 * view, and the three rules read the access modifier from that. The zero rule
 * evaluates the value as a constant rather than reading its spelling.
 *
 * ## What is reproduced, not closed
 *
 * `R.SET <- 0` -- a zero written to the WHOLE `wo` member -- is accepted, as it
 * was. A write-only data or command register takes zero as a value; only the
 * bit forms mean "clear", and only those are rejected. `w1c`/`w1s` members
 * read freely (a status register is read, and written with 1s to clear), and
 * their bits reject zero as codegen's `isWriteOnlyRegister` set did.
 */

import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";

import { CNextListener } from "../../transpiler/logic/parser/grammar/CNextListener";
import * as Parser from "../../transpiler/logic/parser/grammar/CNextParser";
import CodeGenState from "../../transpiler/state/CodeGenState";
import ParserUtils from "../../utils/ParserUtils";
import ScopeUtils from "../../utils/ScopeUtils";
import DeclarationScopeCollector from "./DeclarationScopeCollector";
import ChainRoot from "./helpers/ChainRoot";
import RegisterMemberReference from "./helpers/RegisterMemberReference";
import IRegisterMember from "./types/IRegisterMember";
import IRegisterAccessError from "./types/IRegisterAccessError";
import TChainRoot from "./types/TChainRoot";
import ScopeFrameResolver from "./ScopeFrameResolver";
import ConstantExpression from "./helpers/ConstantExpression";

/** The write-1 modifiers, for which a zero bit write is meaningless. */
const WRITE_ONE = new Set(["wo", "w1s", "w1c"]);

class RegisterAccessListener extends CNextListener {
  private readonly found: IRegisterAccessError[] = [];

  public constructor(private readonly scopes: ScopeFrameResolver) {
    super();
  }

  public errors(): IRegisterAccessError[] {
    return this.found;
  }

  // --- The two positions --------------------------------------------------

  /** Every postfix expression is a read: targets are `assignmentTarget`. */
  override enterPostfixExpression = (
    ctx: Parser.PostfixExpressionContext,
  ): void => {
    const primary = ctx.primaryExpression();
    if (!primary) return;
    const root: TChainRoot = ChainRoot.ofPrimary(primary);
    const names = ctx
      .postfixOp()
      .map((op) => (op.DOT() !== null ? op.IDENTIFIER()!.getText() : null));
    const head = root === null ? primary.IDENTIFIER()?.getText() : undefined;
    const chain = RegisterMemberReference.leadingNames(head, names);
    const found = this.resolve(root, chain, ctx);
    if (found === null) return;
    this.reportRead(found, ctx);
  };

  override enterAssignmentStatement = (
    ctx: Parser.AssignmentStatementContext,
  ): void => {
    const target = ctx.assignmentTarget();
    const root: TChainRoot = ChainRoot.ofTarget(target);
    const ops = target.postfixTargetOp();
    const names = ops.map((op) =>
      op.DOT() !== null ? op.IDENTIFIER()!.getText() : null,
    );
    const chain = RegisterMemberReference.leadingNames(
      target.IDENTIFIER().getText(),
      names,
    );
    const found = this.resolve(root, chain, target);
    if (found === null) return;

    const op = ctx.assignmentOperator().getText();
    if (found.access === "ro") {
      this.report(
        target,
        "E0871",
        `cannot assign to read-only register member '${found.member}' (${found.spelling} has 'ro' access modifier)`,
        "An `ro` register member is hardware that cannot be written (ADR-004); the generated C declares it `const`. Write the register's own writable member, or change the declaration if the hardware allows writes.",
      );
      return;
    }
    if (op !== "<-") {
      // `R.SET +<- 1` reads SET to compute the new value.
      this.reportRead(found, target);
      return;
    }
    // Bit forms: the ops after the member are exactly one subscript.
    const rest = ops.slice(found.consumed - 1);
    if (rest.length !== 1 || rest[0].DOT() !== null) return;
    if (!WRITE_ONE.has(found.access)) return;
    const exprs = rest[0].expression();
    if (!this.isZero(ctx.expression(), target)) return;
    const index = exprs.map((e) => e.getText()).join(", ");
    const what = exprs.length === 1 ? "false to" : "0 to";
    const noun = exprs.length === 1 ? "bit" : "bits";
    this.report(
      target,
      "E0872",
      `Cannot assign ${what} write-only register ${noun} ${found.spelling}[${index}]`,
      "Writing 0 to a write-1 register (`wo`, `w1s`, `w1c`) does not clear the bit -- the hardware ignores zeros, and a spelled-out zero (`0x0`, a const) would have SET it. Use the corresponding CLEAR register to clear bits.",
    );
  };

  // --- Resolution ---------------------------------------------------------

  /**
   * #1322: the chain walk, the candidate order and the shadowing rule moved to
   * `helpers/RegisterMemberReference` when ADR-034's bitmap rules needed the
   * same answer -- a register member may be TYPED by a bitmap, so a bitmap
   * rule has to reach it through the register. Two copies would have been free
   * to disagree about which register a spelling names.
   */
  private resolve(
    root: TChainRoot,
    chain: string[],
    node: ParserRuleContext,
  ): IRegisterMember | null {
    return RegisterMemberReference.resolve(root, chain, node, this.scopes);
  }

  private isZero(
    expr: Parser.ExpressionContext,
    node: ParserRuleContext,
  ): boolean {
    const text = expr.getText().trim();
    if (text === "false") return true;
    // #1322 review: the flat map again -- and this one decides whether a
    // register write clears a `wo` bit, so the wrong scope's const changed
    // which diagnostic fired. `isFalseConst` below was already scope-aware.
    const value = ConstantExpression.valueIn(
      expr,
      this.scopes.frameFor(node).scopePath,
    );
    if (value !== null) return value === 0;
    return this.isFalseConst(text, node);
  }

  /** `const bool NAME <- false`, declared at file scope or in the enclosing scope. */
  private isFalseConst(name: string, node: ParserRuleContext): boolean {
    if (!/^[A-Za-z_]\w*$/.test(name)) return false;
    const here = this.scopes.frameFor(node).scopePath;
    const cNames = [name];
    if (here !== "")
      cNames.unshift(ScopeUtils.getTranspiledCName({ scopePath: here, name }));
    for (const cName of cNames) {
      const symbol = CodeGenState.program?.symbolByCName(cName);
      if (symbol?.kind !== "variable" || !symbol.isConst) continue;
      return symbol.initialValue?.trim() === "false";
    }
    return false;
  }

  // --- Reporting ----------------------------------------------------------

  private reportRead(found: IRegisterMember, at: ParserRuleContext): void {
    if (found.access !== "wo") return;
    this.report(
      at,
      "E0870",
      `cannot read from write-only register member '${found.member}' (${found.spelling} has 'wo' access modifier)`,
      "A `wo` register member is hardware that returns nothing meaningful when read (ADR-004). Read the register's own readable member, or keep a shadow copy of what was written.",
    );
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

class RegisterAccessAnalyzer {
  public analyze(tree: Parser.ProgramContext): IRegisterAccessError[] {
    const declarations = new DeclarationScopeCollector();
    ParseTreeWalker.DEFAULT.walk(declarations, tree);

    const listener = new RegisterAccessListener(
      new ScopeFrameResolver(declarations),
    );
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default RegisterAccessAnalyzer;
