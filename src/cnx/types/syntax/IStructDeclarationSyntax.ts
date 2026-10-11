import type ISyntaxNode from "./ISyntaxNode";
import type TExpression from "./TExpression";
import type TTypeSyntax from "./TTypeSyntax";

/** `struct name { type field dims*; ... }` */
interface IStructDeclarationSyntax extends ISyntaxNode {
  readonly name: string;
  readonly fields: ReadonlyArray<
    ISyntaxNode & {
      readonly type: TTypeSyntax;
      readonly name: string;
      readonly dimensions: ReadonlyArray<TExpression | null>;
    }
  >;
}

export default IStructDeclarationSyntax;
