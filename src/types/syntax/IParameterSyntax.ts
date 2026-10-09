import type ISyntaxNode from "./ISyntaxNode";
import type TExpression from "./TExpression";
import type TTypeSyntax from "./TTypeSyntax";

/** One `parameter`: `const? type name dims*` (a `[]` dimension is `null`) */
interface IParameterSyntax extends ISyntaxNode {
  readonly const: boolean;
  readonly type: TTypeSyntax;
  readonly name: string;
  readonly dimensions: ReadonlyArray<TExpression | null>;
}

export default IParameterSyntax;
