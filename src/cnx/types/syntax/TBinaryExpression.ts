import type TExpression from "./TExpression";

/** One binary level: two or more operands, an operator between each pair */
type TBinaryExpression = Extract<TExpression, { readonly kind: "binary" }>;

export default TBinaryExpression;
