/**
 * ADR-049 declaration modifiers: E0889.
 *
 * #1322. One throw in `VariableModifierBuilder`, reported as `1:0` with its
 * position built into the message text.
 *
 * `atomic` already implies `volatile` -- it is `volatile` plus the guarantee
 * that a read or write cannot be torn -- so writing both says one of two
 * things, and the author has to be asked which. The rule is entirely
 * syntactic: two modifier tokens on one declaration, which is why it needs no
 * type, no frame and no symbols.
 *
 * Every declaration form is checked. Codegen's copy sat in the builder that
 * file-scope and block declarations share, so it saw both; a `for` header's
 * declaration and a parameter carry the same modifiers in the grammar and are
 * asked here too rather than being assumed unreachable.
 */

import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type IVariableDeclarationSyntax from "../../types/syntax/IVariableDeclarationSyntax";
import type TDeclarationSyntax from "../../types/syntax/TDeclarationSyntax";
import type TStatement from "../../types/syntax/TStatement";
import StatementChildren from "../../utils/StatementChildren";
import IDeclarationModifierError from "./types/IDeclarationModifierError";

/** Every variable declaration 1.2 returns: global, scope member, local, `for` header */
class DeclarationModifierAnalyzer {
  private readonly found: IDeclarationModifierError[] = [];

  public analyze(program: IProgramSyntax): IDeclarationModifierError[] {
    for (const member of program.declarations) {
      this.declaration(member.declaration);
    }
    return this.found;
  }

  private declaration(declaration: TDeclarationSyntax): void {
    if (declaration.kind === "scope") {
      for (const member of declaration.members) {
        this.declaration(member.declaration);
      }
    } else if (declaration.kind === "variableDeclaration") {
      this.check(declaration);
    } else if (declaration.kind === "function") {
      this.statements(declaration.body.statements);
    }
  }

  private statements(statements: readonly TStatement[]): void {
    for (const statement of statements) {
      if (statement.kind === "variableDeclaration") {
        this.check(statement);
      } else if (
        statement.kind === "for" &&
        statement.init?.kind === "variableDeclaration"
      ) {
        this.check(statement.init);
      }
      this.statements(StatementChildren.of(statement));
    }
  }

  private check(declaration: IVariableDeclarationSyntax): void {
    if (!declaration.modifiers.atomic || !declaration.modifiers.volatile) {
      return;
    }
    this.found.push({
      code: "E0889",
      line: declaration.span.line,
      column: declaration.span.column,
      message: "Cannot use both 'atomic' and 'volatile' on one declaration",
      helpText:
        "`atomic` already implies `volatile`, and adds that a read or write cannot be torn. Use `atomic` for a variable an ISR shares, or `volatile` alone for a hardware register or a delay loop (ADR-049).",
    });
  }
}

export default DeclarationModifierAnalyzer;
