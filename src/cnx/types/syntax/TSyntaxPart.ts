import type TExpression from "./TExpression";
import type TTypeSyntax from "./TTypeSyntax";

/** One outermost type or expression a declaration, statement or type holds */
type TSyntaxPart =
  | {
      readonly kind: "expression";
      readonly expression: TExpression;
      /**
       * A dimension or an enum value: a constant expression 1.4 settles and
       * spells (ADR-023, #1863), so 2.3 writes no type inside it
       */
      readonly constant: boolean;
    }
  | { readonly kind: "type"; readonly type: TTypeSyntax };

export default TSyntaxPart;
