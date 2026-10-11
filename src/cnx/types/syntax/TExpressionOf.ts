import type TExpression from "./TExpression";

/** The `TExpression` variant of one kind */
type TExpressionOf<K extends TExpression["kind"]> = Extract<
  TExpression,
  { kind: K }
>;

export default TExpressionOf;
