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

import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type IAssignmentSyntax from "../../types/syntax/IAssignmentSyntax";
import type TExpression from "../../types/syntax/TExpression";
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionNodes from "../../utils/ExpressionNodes";
import StatementNodes from "../../utils/StatementNodes";
import RegisterMemberReference from "./helpers/RegisterMemberReference";
import IRegisterMember from "./types/IRegisterMember";
import IRegisterAccessError from "./types/IRegisterAccessError";
import ZeroValue from "./helpers/ZeroValue";
import RegisterAccessMode from "../../utils/RegisterAccessMode";
import type IAnalysisContext from "./types/IAnalysisContext";
import SourceOrder from "../../utils/SourceOrder";

class RegisterAccessCheck {
  private readonly found: IRegisterAccessError[] = [];

  public constructor(private readonly context: IAnalysisContext) {}

  public errors(): IRegisterAccessError[] {
    return this.found;
  }

  // --- The two positions --------------------------------------------------

  /** Every postfix expression is a read: targets are `assignmentTarget`. */
  public checkExpression(expr: TExpression): void {
    const found = RegisterMemberReference.ofChain(expr, this.context);
    if (found === null) return;
    this.reportRead(found, expr);
  }

  /** The target's operations after its first name, as `consumed` counts them */
  private static opsAfterHead(
    target: TExpression,
  ): Extract<TExpression, { kind: "postfix" }>["ops"] {
    if (target.kind !== "postfix") return [];
    return target.primary.kind === "root" ? target.ops.slice(1) : target.ops;
  }

  /** A write, in a statement or a `for` header (#1726) */
  public checkSite(site: IAssignmentSyntax): void {
    const target = site.target;
    const ops = RegisterAccessCheck.opsAfterHead(target);
    const found = RegisterMemberReference.ofChain(target, this.context);
    if (found === null) return;

    const op = site.operator;
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
    if (rest.length !== 1) return;
    const last = rest[0];
    if (last.kind !== "subscript") return;
    if (!RegisterAccessMode.isWriteOne(found.access)) return;
    const exprs = last.indexes;
    if (!ZeroValue.of(site.value, target, this.context)) return;
    const index = exprs.map((e) => e.written).join(", ");
    const what = exprs.length === 1 ? "false to" : "0 to";
    const noun = exprs.length === 1 ? "bit" : "bits";
    this.report(
      target,
      "E0872",
      `Cannot assign ${what} write-only register ${noun} ${found.spelling}[${index}]`,
      "Writing 0 to a write-1 register (`wo`, `w1s`, `w1c`) does not clear the bit -- the hardware ignores zeros, and a spelled-out zero (`0x0`, a const) would have SET it. Use the corresponding CLEAR register to clear bits.",
    );
  }

  // --- Resolution ---------------------------------------------------------

  // --- Reporting ----------------------------------------------------------

  private reportRead(found: IRegisterMember, at: TExpression): void {
    if (found.access !== "wo") return;
    this.report(
      at,
      "E0870",
      `cannot read from write-only register member '${found.member}' (${found.spelling} has 'wo' access modifier)`,
      "A `wo` register member is hardware that returns nothing meaningful when read (ADR-004). Read the register's own readable member, or keep a shadow copy of what was written.",
    );
  }

  private report(
    at: TExpression,
    code: string,
    message: string,
    helpText: string,
  ): void {
    const line = at.span.line;
    const column = at.span.column;
    this.found.push({ code, line, column, message, helpText });
  }
}

class RegisterAccessAnalyzer {
  /** #1456: handed in rather than read off shared state. */
  constructor(private readonly context: IAnalysisContext) {}

  /** #1991: reads 1.2's syntax, not the parse tree */
  public analyze(program: IProgramSyntax): IRegisterAccessError[] {
    const check = new RegisterAccessCheck(this.context);
    for (const member of program.declarations) {
      const sites = StatementNodes.assignments(member.declaration);
      const targets = new Set<TExpression>(sites.map((site) => site.target));
      for (const expr of DeclarationParts.of(member.declaration).flatMap(
        ExpressionNodes.of,
      )) {
        if (!targets.has(expr)) check.checkExpression(expr);
      }
      for (const site of sites) check.checkSite(site);
    }
    return check.errors().sort(SourceOrder.compare);
  }
}

export default RegisterAccessAnalyzer;
