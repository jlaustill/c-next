import type TExpression from "./TExpression";
import type TTypeSyntax from "./TTypeSyntax";

/** One outermost type or expression a declaration, statement or type holds */
type TSyntaxPart =
  | { readonly kind: "expression"; readonly expression: TExpression }
  | { readonly kind: "type"; readonly type: TTypeSyntax };

export default TSyntaxPart;
