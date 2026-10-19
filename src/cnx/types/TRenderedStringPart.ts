/**
 * A `TStringPart` as generated C, which `StringUtils.build` lowers: a whole
 * string's expression, or a substring's source, start and length -- the
 * length 2.2 folded, which E0919 has made a compile-time constant (#2240).
 */
type TRenderedStringPart =
  | { readonly kind: "whole"; readonly code: string }
  | {
      readonly kind: "substring";
      readonly source: string;
      readonly start: string;
      readonly length: number;
    };

export default TRenderedStringPart;
