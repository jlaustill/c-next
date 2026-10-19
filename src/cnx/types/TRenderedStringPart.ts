/**
 * A `TStringPart` as generated C, which `StringUtils.build` lowers: a whole
 * string's expression, or a substring's source, start and length.
 */
type TRenderedStringPart =
  | { readonly kind: "whole"; readonly code: string }
  | {
      readonly kind: "substring";
      readonly source: string;
      readonly start: string;
      readonly length: string;
    };

export default TRenderedStringPart;
