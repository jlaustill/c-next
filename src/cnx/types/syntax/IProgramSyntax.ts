import type IComment from "../IComment";
import type ISyntaxNode from "./ISyntaxNode";
import type TDeclarationSyntax from "./TDeclarationSyntax";
import type TDirectiveKind from "./TDirectiveKind";

/** Comments written directly above a top-level item */
type TCommented = { readonly leadingComments: readonly IComment[] };

/** A `.cnx` file: its includes, directives and declarations, each in source order */
interface IProgramSyntax {
  readonly includes: ReadonlyArray<ISyntaxNode & TCommented>;
  readonly directives: ReadonlyArray<
    ISyntaxNode &
      TCommented & {
        readonly kind: TDirectiveKind;
        readonly text: string;
      }
  >;
  readonly declarations: ReadonlyArray<
    TCommented & { readonly declaration: TDeclarationSyntax }
  >;
}

export default IProgramSyntax;
