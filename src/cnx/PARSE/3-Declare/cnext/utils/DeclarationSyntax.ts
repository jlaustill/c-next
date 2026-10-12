/**
 * DeclarationSyntax -- one declaration of 1.2's plain-data `IProgramSyntax`,
 * narrowed to the kind its collector reads (#1991). 1.3 reads what 1.2
 * returned, never the parse tree.
 */
import invariant from "../../../../utils/invariant";
import type TDeclarationSyntax from "../../../../types/syntax/TDeclarationSyntax";

type TKind = TDeclarationSyntax["kind"];

class DeclarationSyntax {
  static of<K extends TKind>(
    syntax: TDeclarationSyntax,
    kind: K,
  ): Extract<TDeclarationSyntax, { kind: K }> {
    invariant(
      DeclarationSyntax.is(syntax, kind),
      `1.2 lowered this declaration as ${syntax.kind}, and 1.3 read it as ${kind}`,
    );
    return syntax;
  }

  private static is<K extends TKind>(
    syntax: TDeclarationSyntax,
    kind: K,
  ): syntax is Extract<TDeclarationSyntax, { kind: K }> {
    return syntax.kind === kind;
  }
}

export default DeclarationSyntax;
