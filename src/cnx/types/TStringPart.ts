import type TExpression from "./syntax/TExpression";
import type TExpressionOf from "./syntax/TExpressionOf";

/**
 * One piece of a string an ADR-045 write builds: a whole string -- a
 * literal, a `string<N>`, a field or an element of one, a C string -- or a
 * substring `source[start, length]` of one (`length` null: `source[start]`,
 * one character). A substring keeps its whole chain: its source is the
 * chain without its last subscript.
 */
type TStringPart =
  | { readonly kind: "whole"; readonly value: TExpression }
  | {
      readonly kind: "substring";
      readonly chain: TExpressionOf<"postfix">;
      readonly start: TExpression;
      readonly length: TExpression | null;
    };

export default TStringPart;
