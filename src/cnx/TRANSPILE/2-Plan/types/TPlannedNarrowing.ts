/**
 * 2.2's decision for a value C promotes to `int` -- a bit read, a bitmap field
 * read or a character literal -- written against a narrower type (MISRA
 * C:2012 Rule 10.3): cast it to `cType`, or compare it `!= 0U` for a `bool`
 * (Rule 10.5)
 */
type TPlannedNarrowing =
  | { readonly kind: "cast"; readonly cType: string }
  | { readonly kind: "compare" };

export default TPlannedNarrowing;
