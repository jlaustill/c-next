import type ISyntaxNode from "./ISyntaxNode";
import type TExpression from "./TExpression";
import type TTypeSyntax from "./TTypeSyntax";

/** `[atomic] [volatile] [const] [clamp|wrap] Type name[dims] [<- value]` */
interface IVariableDeclarationSyntax extends ISyntaxNode {
  readonly modifiers: {
    readonly atomic: boolean;
    readonly volatile: boolean;
    /** Always false in a for header, whose grammar has no `const` */
    readonly const: boolean;
    readonly overflow: "clamp" | "wrap" | null;
  };
  readonly type: TTypeSyntax;
  readonly name: string;
  readonly nameSpan: ISyntaxNode["span"];
  /** Dimensions after the name, `[]` written as null */
  readonly dimensions: ReadonlyArray<TExpression | null>;
  readonly initializer: TExpression | null;
}

export default IVariableDeclarationSyntax;
