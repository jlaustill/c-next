/**
 * `this` and `global` are only meaningful inside a `scope` (ADR-016).
 *
 * `this` names the enclosing scope's own member; `global` reaches a file-scope
 * name past a scope member that shadows it. Outside a scope there is neither
 * an enclosing scope nor a member to see past, so both are E0431 (#2087).
 *
 * #1322, the first family relocated out of `output/`. This rule was enforced
 * from FOUR places -- `CodeGenerator`, `BaseIdentifierBuilder`, and
 * `PostfixExpressionGenerator` twice -- each throwing the identical string, and
 * a fifth, `CodeGenErrors.scopedTypeOutsideScope`, had no caller at all. Four
 * more copies were unreachable and were deleted in 1322a: `this.x <- 5` at file
 * scope is a PARSE error, so the assignment-path guards could never fire.
 *
 * Every copy reached the user as `1:0`, because a throw from codegen carries no
 * position -- `ErrorLocation.parse` has nothing to scrape and falls
 * back. That is the defect this card exists to fix, and it is why the rule
 * moves rather than being tidied where it stood.
 *
 * ## Why this family first
 *
 * The rule is purely syntactic: is this `this` lexically inside a
 * `scopeDeclaration`? It needs no symbol table, no type registry, and no
 * cross-file fact, so it exercises the relocation end to end without also
 * depending on what 2.1 can see -- which is a separate question, and the one
 * `IDeclaredVar` answers.
 *
 * ## All three contexts, not just the obvious one
 *
 * `THIS` appears in `PrimaryExpressionContext` (a read), `AssignmentTargetContext`
 * (a write), `ScopedTypeContext` (`this.Type` in a type position) and
 * `CaseLabelContext` (`case this.LIMIT`, #1629). A walk
 * that visited only expressions would silently stop rejecting the other two,
 * which is how a rule with a hole becomes more dangerous than no rule: people
 * trust it.
 *
 * ## One behavior change, asserted rather than discovered
 *
 * A throw aborts at the first occurrence; this reports every `this` in the file.
 * Fixtures with more than one offending line therefore gain lines rather than
 * changing them.
 */

import type ISourceSpan from "../../types/ISourceSpan";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TCaseLabelSyntax from "../../types/syntax/TCaseLabelSyntax";
import type TExpression from "../../types/syntax/TExpression";
import type TSyntaxPart from "../../types/syntax/TSyntaxPart";
import type TTypeSyntax from "../../types/syntax/TTypeSyntax";
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionChildren from "../../utils/ExpressionChildren";
import StatementNodes from "../../utils/StatementNodes";
import TypeParts from "../../utils/TypeParts";
import IThisOutsideScopeError from "./types/IThisOutsideScopeError";

const HELP = {
  this: "`this` names the enclosing scope's own member. Outside a scope, write a file-scope declaration by its bare name, or move the code into the scope it belongs to.",
  global:
    "`global` reaches a file-scope declaration past a scope member that shadows it. Outside a scope no member shadows it, so write its bare name.",
} as const;

/** `this` or `global` as a value, an assignment target's root, a type's qualifier or a case label's root, anywhere outside a top-level scope */
class ThisOutsideScopeAnalyzer {
  private readonly found: IThisOutsideScopeError[] = [];

  public analyze(program: IProgramSyntax): IThisOutsideScopeError[] {
    for (const member of program.declarations) {
      if (member.declaration.kind === "scope") continue;
      for (const part of DeclarationParts.of(member.declaration)) {
        this.part(part);
      }
      for (const label of StatementNodes.caseLabels(member.declaration)) {
        this.caseLabel(label);
      }
    }
    return this.found;
  }

  private part(part: TSyntaxPart): void {
    if (part.kind === "type") {
      this.type(part.type);
    } else {
      this.expression(part.expression);
    }
  }

  private type(type: TTypeSyntax): void {
    if (type.kind === "scoped") this.report(type.span, "this");
    if (type.kind === "global") this.report(type.span, "global");
    for (const part of TypeParts.of(type)) this.part(part);
  }

  private expression(expr: TExpression): void {
    if (expr.kind === "root") this.report(expr.span, expr.root);
    if (expr.kind === "cast") this.type(expr.type);
    for (const child of ExpressionChildren.of(expr)) this.expression(child);
  }

  /** `case this.X` (#1629), `case global.X` (#2087): a case label is not an expression */
  private caseLabel(label: TCaseLabelSyntax): void {
    if (
      (label.kind === "identifier" || label.kind === "qualified") &&
      label.root !== null
    ) {
      this.report(label.span, label.root);
    }
  }

  private report(span: ISourceSpan, root: "this" | "global"): void {
    this.found.push({
      code: "E0431",
      line: span.line,
      column: span.column,
      message: `'${root}' can only be used inside a scope`,
      helpText: HELP[root],
    });
  }
}

export default ThisOutsideScopeAnalyzer;
