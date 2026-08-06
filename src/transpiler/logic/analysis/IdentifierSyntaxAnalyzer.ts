/**
 * Identifier Syntax Analyzer
 * ADR-063 / Issue #1117: Validates the underscore rule on declared identifiers.
 *
 * A C-Next identifier may not end with `_` and may not contain `__`. That reserves
 * `__` exclusively for the transpiler as the qualified-name separator, which makes
 * `Scope__member` injective: distinct declarations can no longer produce the same C
 * identifier. A leading underscore stays legal — injectivity constrains only the
 * separator's left boundary, so the `_handler` private-member idiom (ADR-029) is
 * unaffected.
 *
 * Only DECLARATION contexts are checked. References are deliberately skipped, which
 * is what lets a C-Next file call an external C symbol such as `__disable_irq()`
 * without tripping the rule (ADR-010, ADR-063).
 */

import { ParseTreeWalker, TerminalNode } from "antlr4ng";
import { CNextListener } from "../parser/grammar/CNextListener";
import * as Parser from "../parser/grammar/CNextParser";
import IIdentifierSyntaxError from "./types/IIdentifierSyntaxError";
import TIdentifierViolation from "./types/TIdentifierViolation";

/**
 * Pure function classifying an identifier against the ADR-063 rule.
 *
 * @param identifierName - The identifier as written in the source
 * @returns The violation kind, or null when the identifier is legal
 */
function classifyIdentifier(
  identifierName: string,
): TIdentifierViolation | null {
  if (identifierName.includes("__")) {
    return "consecutive";
  }
  if (identifierName.endsWith("_")) {
    return "trailing";
  }
  return null;
}

/**
 * Pure function creating the error message for a violation.
 */
function formatIdentifierSyntaxError(
  identifierName: string,
  violation: TIdentifierViolation,
): string {
  if (violation === "consecutive") {
    return (
      `Identifier '${identifierName}' cannot contain consecutive underscores. ` +
      `'__' is reserved as the separator for scope-qualified names in generated C.`
    );
  }
  return (
    `Identifier '${identifierName}' cannot end with an underscore. ` +
    `A trailing underscore would make scope-qualified names ambiguous in generated C.`
  );
}

/**
 * Pure function producing a name that satisfies the rule.
 *
 * Applies BOTH normalizations regardless of which clause was reported, because an
 * identifier can break both at once. `classifyIdentifier` reports "consecutive"
 * first, so fixing only that would suggest `my_value_` for `my__value_` — a name
 * E0201 itself rejects.
 */
function suggestLegalIdentifier(identifierName: string): string {
  return identifierName.replaceAll(/_+/g, "_").replace(/_+$/, "");
}

/**
 * Pure function creating the help text for a violation.
 */
function formatIdentifierSyntaxHelp(
  identifierName: string,
  violation: TIdentifierViolation,
): string {
  const suggestion = suggestLegalIdentifier(identifierName);
  if (violation === "consecutive") {
    return `Use a single underscore instead (e.g. '${suggestion}')`;
  }
  return `Remove the trailing underscore (e.g. '${suggestion}')`;
}

/**
 * Listener that walks every declaration context checking the declared identifier.
 *
 * Each handler delegates to the analyzer's single check() entry point rather than
 * repeating the classify/report logic, which keeps the thirteen near-identical
 * handlers from tripping duplication analysis.
 */
class IdentifierSyntaxListener extends CNextListener {
  private readonly analyzer: IdentifierSyntaxAnalyzer;

  constructor(analyzer: IdentifierSyntaxAnalyzer) {
    super();
    this.analyzer = analyzer;
  }

  override enterScopeDeclaration = (
    ctx: Parser.ScopeDeclarationContext,
  ): void => {
    this.analyzer.check(ctx.IDENTIFIER());
  };

  override enterRegisterDeclaration = (
    ctx: Parser.RegisterDeclarationContext,
  ): void => {
    this.analyzer.check(ctx.IDENTIFIER());
  };

  override enterRegisterMember = (ctx: Parser.RegisterMemberContext): void => {
    this.analyzer.check(ctx.IDENTIFIER());
  };

  override enterStructDeclaration = (
    ctx: Parser.StructDeclarationContext,
  ): void => {
    this.analyzer.check(ctx.IDENTIFIER());
  };

  override enterStructMember = (ctx: Parser.StructMemberContext): void => {
    this.analyzer.check(ctx.IDENTIFIER());
  };

  override enterEnumDeclaration = (
    ctx: Parser.EnumDeclarationContext,
  ): void => {
    this.analyzer.check(ctx.IDENTIFIER());
  };

  override enterEnumMember = (ctx: Parser.EnumMemberContext): void => {
    this.analyzer.check(ctx.IDENTIFIER());
  };

  override enterBitmapDeclaration = (
    ctx: Parser.BitmapDeclarationContext,
  ): void => {
    this.analyzer.check(ctx.IDENTIFIER());
  };

  override enterBitmapMember = (ctx: Parser.BitmapMemberContext): void => {
    this.analyzer.check(ctx.IDENTIFIER());
  };

  override enterFunctionDeclaration = (
    ctx: Parser.FunctionDeclarationContext,
  ): void => {
    this.analyzer.check(ctx.IDENTIFIER());
  };

  override enterParameter = (ctx: Parser.ParameterContext): void => {
    this.analyzer.check(ctx.IDENTIFIER());
  };

  override enterVariableDeclaration = (
    ctx: Parser.VariableDeclarationContext,
  ): void => {
    this.analyzer.check(ctx.IDENTIFIER());
  };

  override enterForVarDecl = (ctx: Parser.ForVarDeclContext): void => {
    this.analyzer.check(ctx.IDENTIFIER());
  };
}

/**
 * Analyzer for identifier syntax violations (ADR-063)
 */
class IdentifierSyntaxAnalyzer {
  private errors: IIdentifierSyntaxError[] = [];

  /**
   * Analyze the parse tree for identifier syntax violations
   *
   * @param tree - The parsed program AST
   * @returns Array of errors (empty if all pass)
   */
  public analyze(tree: Parser.ProgramContext): IIdentifierSyntaxError[] {
    this.errors = [];

    const listener = new IdentifierSyntaxListener(this);
    ParseTreeWalker.DEFAULT.walk(listener, tree);

    return this.errors;
  }

  /**
   * Check one declared identifier, recording an error if it breaks the rule.
   *
   * Single entry point for all declaration contexts, so the rule and its reported
   * position are defined in exactly one place.
   */
  public check(identifier: TerminalNode): void {
    const identifierName = identifier.getText();
    const violation = classifyIdentifier(identifierName);

    if (violation === null) {
      return;
    }

    this.errors.push({
      code: "E0201",
      identifierName,
      violation,
      // The identifier's own token, not the enclosing rule's start token
      line: identifier.symbol.line,
      column: identifier.symbol.column,
      message: formatIdentifierSyntaxError(identifierName, violation),
      helpText: formatIdentifierSyntaxHelp(identifierName, violation),
    });
  }
}

export default IdentifierSyntaxAnalyzer;
