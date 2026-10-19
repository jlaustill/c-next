import type TExpression from "./syntax/TExpression";
import type TStringPart from "./TStringPart";

/**
 * What a value written whole into a `string<N>` is (ADR-045), however it is
 * parenthesized: a string literal, one string copied in, one substring, or a
 * concatenation of two or more parts. `StringValueForm.of` decides it once,
 * for a declaration's initializer and an assignment's value alike.
 */
type TStringValueForm =
  | { readonly kind: "literal"; readonly literal: TExpression }
  | { readonly kind: "copy"; readonly value: TExpression }
  | {
      readonly kind: "substring";
      readonly part: Extract<TStringPart, { kind: "substring" }>;
    }
  | { readonly kind: "concat"; readonly parts: readonly TStringPart[] };

export default TStringValueForm;
