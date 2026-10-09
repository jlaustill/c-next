import type TRegisterAccessMode from "../TRegisterAccessMode";
import type ISyntaxNode from "./ISyntaxNode";
import type TExpression from "./TExpression";
import type TTypeSyntax from "./TTypeSyntax";

/** `register name @ address { member: type access @ offset, ... }` */
interface IRegisterDeclarationSyntax extends ISyntaxNode {
  readonly name: string;
  readonly address: TExpression;
  readonly members: ReadonlyArray<
    ISyntaxNode & {
      readonly name: string;
      readonly type: TTypeSyntax;
      readonly access: TRegisterAccessMode;
      readonly offset: TExpression;
    }
  >;
}

export default IRegisterDeclarationSyntax;
