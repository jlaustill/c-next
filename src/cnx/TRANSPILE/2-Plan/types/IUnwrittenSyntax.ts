import type TDeclarationSyntax from "../../../types/syntax/TDeclarationSyntax";
import type TExpression from "../../../types/syntax/TExpression";

/** What 2.2 decided 2.3 writes none of the syntax of */
interface IUnwrittenSyntax {
  /** Declarations written as nothing, e.g. an inlined private const (#282) */
  readonly declarations: ReadonlySet<TDeclarationSyntax>;
  /** #1735: every expression in a static-storage value written as its folded value */
  readonly values: ReadonlySet<TExpression>;
}

export default IUnwrittenSyntax;
