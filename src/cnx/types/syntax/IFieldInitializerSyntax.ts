import type ISyntaxNode from "./ISyntaxNode";
import type TExpression from "./TExpression";

/** `name: value` inside a struct initializer */
interface IFieldInitializerSyntax extends ISyntaxNode {
  readonly name: string;
  readonly value: TExpression;
}

export default IFieldInitializerSyntax;
