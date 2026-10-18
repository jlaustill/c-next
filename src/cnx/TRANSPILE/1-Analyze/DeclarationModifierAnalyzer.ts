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
import VariableDeclarations from "../../utils/VariableDeclarations";
import IDeclarationModifierError from "./types/IDeclarationModifierError";

/** Every variable declaration 1.2 returns: global, scope member, local, `for` header */
class DeclarationModifierAnalyzer {
  private readonly found: IDeclarationModifierError[] = [];

  public analyze(program: IProgramSyntax): IDeclarationModifierError[] {
    for (const entry of VariableDeclarations.in(program)) {
      this.check(entry.declaration);
    }
    return this.found;
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
