/**
 * ADR-013 const enforcement: E0877, E0878.
 *
 * #1322. Four throws in `output/` -- three in `AssignmentValidator` (a
 * simple target, an array element, a member access, each asking
 * `TypeValidator.checkConstAssignment` about the ROOT name) and one in
 * `CallExprGenerator` for a const value passed to a non-const parameter --
 * every one reaching the user as `1:0`, across twenty-six fixtures that
 * assert that position.
 *
 * ## The root of the target is the whole question
 *
 * `CONFIG <- 5`, `table[0] <- 1`, `cfg.x <- 2`, `this.K +<- 1`: whatever the
 * form, the target is reached through one declared name, and that name's
 * const-ness decides (ADR-013 "every assignment form, one decision"). The
 * name is a parameter or a variable of the enclosing frames, a scope member
 * through `this.`, or -- a const declared in an included file -- a symbol of
 * the program.
 *
 * ## Two holes closed, probed
 *
 * A `for` header's assignment and update (`for (K <- 0; …; K +<- 1)`) never
 * reached `AssignmentValidator`, so `K += 1` was emitted against a `const`
 * and the C compiler rejected it. They carry an `assignmentTarget` like any
 * statement and are checked here on the same terms.
 */

import ExpressionShape from "../../utils/ExpressionShape";
import OperandTyper from "../../utils/OperandTyper";
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionNodes from "../../utils/ExpressionNodes";
import StatementNodes from "../../utils/StatementNodes";
import FunctionReference from "./helpers/FunctionReference";
import BoundDeclaration from "./helpers/BoundDeclaration";
import SafeDivision from "./helpers/SafeDivision";
import IConstAssignmentError from "./types/IConstAssignmentError";
import TChainRoot from "../../types/TChainRoot";
import type ISourceSpan from "../../types/ISourceSpan";
import type IAnalysisContext from "./types/IAnalysisContext";
import type IAssignmentSyntax from "../../types/syntax/IAssignmentSyntax";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TExpression from "../../types/syntax/TExpression";
import type TPostfixOpSyntax from "../../types/syntax/TPostfixOpSyntax";

/** What kind of const binding a name is, or null when it is not const. */
type TConstKind = "parameter" | "variable" | null;

type TPosition = Pick<ISourceSpan, "line" | "column">;

/** An assignment target as a declared name and what is written through it */
interface ITargetName {
  readonly root: TChainRoot;
  readonly name: string;
  readonly ops: readonly TPostfixOpSyntax[];
}

class ConstAssignmentCheck {
  private readonly found: IConstAssignmentError[] = [];

  public constructor(private readonly context: IAnalysisContext) {}

  public errors(): IConstAssignmentError[] {
    return this.found;
  }

  /** Every assignment form -- a statement, a `for` init, a `for` update. */
  public checkSite(site: IAssignmentSyntax): void {
    const target = ConstAssignmentCheck.targetName(site.target);
    if (target === null) return;
    const kind = this.constKind(target.root, target.name, site.target.span);
    if (kind === null) return;

    const suffix = ConstAssignmentCheck.targetSuffix(target.ops);
    this.report(
      site.target.span,
      "E0877",
      `cannot assign to const ${kind} '${target.name}'${suffix}`,
      kind === "parameter"
        ? "A const parameter is read-only for the whole function (ADR-013); remove `const` from the parameter if the function must change it."
        : "A const binding is read-only after its declaration (ADR-013); remove `const` if the value must change.",
    );
  }

  /** `K`, `table[0]`, `this.K`, `global.cfg.x`: the name the target is reached through */
  private static targetName(target: TExpression): ITargetName | null {
    if (target.kind === "identifier") {
      return { root: null, name: target.name, ops: [] };
    }
    if (target.kind !== "postfix") return null;
    if (target.primary.kind === "identifier") {
      return { root: null, name: target.primary.name, ops: target.ops };
    }
    const first = target.ops[0];
    if (target.primary.kind !== "root" || first.kind !== "member") return null;
    return {
      root: target.primary.root,
      name: first.name,
      ops: target.ops.slice(1),
    };
  }

  /** How the target's shape is named in E0877's message. */
  private static targetSuffix(ops: readonly TPostfixOpSyntax[]): string {
    if (ops.some((op) => op.kind === "subscript")) return " (array element)";
    if (ops.some((op) => op.kind === "member")) return " (member access)";
    return "";
  }

  /**
   * E0877 at a site that is not an assignment: ADR-051's `safe_div`/`safe_mod`
   * write their result through the FIRST argument, so a const there is written
   * to exactly as `K <- 1` writes to one.
   *
   * The const rule walks assignment targets and a call argument is not one, so
   * this site was invisible to it: `safe_div(K, 10, 2, 0)` emitted `&K` into a
   * non-const pointer parameter and reached the C compiler as
   * `discards 'const' qualifier`, at exit 0. Which argument is the output is
   * ADR-051's fact and is asked of `SafeDivision`, so this rule does not carry
   * a second opinion about the builtins' signature.
   */
  private checkSafeDivisionOutput(expr: TExpression): void {
    const call = SafeDivision.callOf(expr);
    if (call === null) return;
    const output = SafeDivision.outputName(call.args);
    if (output === null) return; // not a variable at all -- E0885's to report
    // Always a BARE name: `outputName` accepts only a plain identifier, so a
    // `this.`-rooted first argument returns null above and is E0885's to report.
    const kind = this.constKind(null, output, expr.span);
    if (kind === null) return;
    this.report(
      call.args[0].span,
      "E0877",
      `cannot assign to const ${kind} '${output}' (${call.name} output)`,
      `${call.name} writes its result through its first argument, so a const cannot receive it; remove \`const\`, or pass a mutable variable (ADR-013).`,
    );
  }

  /** E0878: a const value passed where the callee may write. */
  public checkExpression(expr: TExpression): void {
    if (expr.kind !== "postfix") return;
    const call = expr.ops.find((op) => op.kind === "call");
    if (call?.kind !== "call") return;
    this.checkSafeDivisionOutput(expr);
    const callee = FunctionReference.ofCallChain(
      expr,
      OperandTyper.scopePathAt(expr.span, this.context),
      this.context,
    );
    if (callee === null) return;
    call.arguments.forEach((arg, index) => {
      const param = callee.parameters[index];
      if (param === undefined || param.isConst) return;
      const argName = this.constArgumentName(arg);
      if (argName === null) return;
      this.report(
        arg.span,
        "E0878",
        `cannot pass const '${argName}' to non-const parameter '${param.name}' of function '${callee.name}'`,
        "The callee may write through that parameter; declare it `const` in the callee, or pass a mutable copy (ADR-013).",
      );
    });
  }

  // --- The facts -----------------------------------------------------------

  /**
   * The name of a const binding an argument IS -- `K`, `this.K`, `global.K`
   * -- or null for anything else (an expression has no binding to protect).
   */
  private constArgumentName(arg: TExpression): string | null {
    const bare = ExpressionShape.simpleIdentifier(arg);
    if (bare !== null) {
      return this.constKind(null, bare, arg.span) === null ? null : bare;
    }
    if (arg.kind !== "postfix" || arg.primary.kind !== "root") return null;
    const member = arg.ops[0];
    if (arg.ops.length !== 1 || member.kind !== "member") return null;
    const root = arg.primary.root;
    return this.constKind(root, member.name, arg.span) === null
      ? null
      : `${root}.${member.name}`;
  }

  /**
   * Whether the spelling `root.name`, as seen from `at`, is a const parameter,
   * a const variable, or neither.
   *
   * Which declaration the spelling binds to is Program's one binder's
   * decision (#1668), not this rule's: a local, a parameter, a scope member
   * or a global, this file's or an included one's, in ADR-057's order with
   * `this.` and `global.` stating where. #1322 review: this file once had its
   * own, with a `global.` arm and no `this.` arm -- so `this.STEP <- 5` with a
   * local `STEP` shadowing the const member resolved to the local, lost E0877,
   * and emitted `Board__STEP = 5U;` at exit 0.
   */
  private constKind(root: TChainRoot, name: string, at: TPosition): TConstKind {
    const binding = this.context.program.bindValue(
      this.context.sourceFile,
      root,
      name,
      at,
    );
    const declared = BoundDeclaration.of(binding);
    if (!declared?.isConst) return null;
    return declared.isParameter ? "parameter" : "variable";
  }

  private report(
    at: TPosition,
    code: string,
    message: string,
    helpText: string,
  ): void {
    this.found.push({
      code,
      line: at.line,
      column: at.column,
      message,
      helpText,
    });
  }
}

class ConstAssignmentAnalyzer {
  /** #1456: handed in rather than read off shared state. */
  constructor(private readonly context: IAnalysisContext) {}

  public analyze(program: IProgramSyntax): IConstAssignmentError[] {
    const check = new ConstAssignmentCheck(this.context);
    for (const member of program.declarations) {
      for (const site of StatementNodes.assignments(member.declaration)) {
        check.checkSite(site);
      }
      for (const part of DeclarationParts.of(member.declaration)) {
        for (const expr of ExpressionNodes.of(part))
          check.checkExpression(expr);
      }
    }
    // Read off 1.2's syntax (#1991); reported in source order
    return check
      .errors()
      .sort((a, b) => a.line - b.line || a.column - b.column);
  }
}

export default ConstAssignmentAnalyzer;
