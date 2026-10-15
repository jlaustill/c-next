/**
 * `this` is only meaningful inside a `scope`, and `global` inside a scope or a
 * function (ADR-016).
 *
 * `this` names the enclosing scope's own member; `global` reaches a file-scope
 * name past a scope member, local or parameter that shadows it. At file level
 * nothing shadows a file-scope name, so `global` there is E0431 too (#2087).
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

const OUTSIDE = {
  this: {
    message: "'this' can only be used inside a scope",
    helpText:
      "`this` names the enclosing scope's own member. Outside a scope, write a file-scope declaration by its bare name, or move the code into the scope it belongs to.",
  },
  global: {
    message: "'global' can only be used inside a scope or a function",
    helpText:
      "`global` reaches a file-scope declaration past a name that shadows it inside a scope or a function. At file level nothing shadows it, so write its bare name.",
  },
} as const;

/**
 * `this` as a value, an assignment target's root, a type's qualifier or a case
 * label's root anywhere outside a top-level scope; `global` as a value or a
 * type's qualifier at file level. A case label sits in a function body, where
 * `global` is legal.
 */
class ThisOutsideScopeAnalyzer {
  private readonly found: IThisOutsideScopeError[] = [];

  public analyze(program: IProgramSyntax): IThisOutsideScopeError[] {
    for (const member of program.declarations) {
      if (member.declaration.kind === "scope") continue;
      // A function body is a scope for `global` (#2087), not for `this`
      const globalAllowed = member.declaration.kind === "function";
      for (const part of DeclarationParts.of(member.declaration)) {
        this.part(part, globalAllowed);
      }
      for (const label of StatementNodes.caseLabels(member.declaration)) {
        this.caseLabel(label);
      }
    }
    return this.found;
  }

  private part(part: TSyntaxPart, globalAllowed: boolean): void {
    if (part.kind === "type") {
      this.type(part.type, globalAllowed);
    } else {
      this.expression(part.expression, globalAllowed);
    }
  }

  private type(type: TTypeSyntax, globalAllowed: boolean): void {
    if (type.kind === "scoped") this.report(type.span, "this");
    if (type.kind === "global" && !globalAllowed) {
      this.report(type.span, "global");
    }
    for (const part of TypeParts.of(type)) this.part(part, globalAllowed);
  }

  private expression(expr: TExpression, globalAllowed: boolean): void {
    if (expr.kind === "root" && (expr.root === "this" || !globalAllowed)) {
      this.report(expr.span, expr.root);
    }
    if (expr.kind === "cast") this.type(expr.type, globalAllowed);
    for (const child of ExpressionChildren.of(expr)) {
      this.expression(child, globalAllowed);
    }
  }

  /** `case this.X` (#1629): a case label is not an expression */
  private caseLabel(label: TCaseLabelSyntax): void {
    if (
      (label.kind === "identifier" || label.kind === "qualified") &&
      label.root === "this"
    ) {
      this.report(label.span, label.root);
    }
  }

  private report(span: ISourceSpan, root: "this" | "global"): void {
    this.found.push({
      code: "E0431",
      line: span.line,
      column: span.column,
      ...OUTSIDE[root],
    });
  }
}

export default ThisOutsideScopeAnalyzer;
