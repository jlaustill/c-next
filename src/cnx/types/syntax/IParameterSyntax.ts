import type ISyntaxNode from "./ISyntaxNode";
import type TExpression from "./TExpression";
import type TTypeSyntax from "./TTypeSyntax";

/** One `parameter`: `const? mut? type name dims*` (a `[]` dimension is `null`) */
interface IParameterSyntax extends ISyntaxNode {
  /** ADR-071: parsed only so it can be rejected */
  readonly const: boolean;
  /** ADR-071: the binding may be written */
  readonly mut: boolean;
  readonly type: TTypeSyntax;
  readonly name: string;
  readonly nameSpan: ISyntaxNode["span"];
  readonly dimensions: ReadonlyArray<TExpression | null>;
}

export default IParameterSyntax;
