/**
 * How many elements an array dimension gives (#1874, #1283 review): a count,
 * a value C-Next read that is not a count (zero or negative), or a value it
 * cannot read (a name it cannot see the value of, an overflow).
 */
type TElementCount =
  | { readonly kind: "count"; readonly value: number }
  | { readonly kind: "notPositive"; readonly value: bigint }
  | { readonly kind: "unreadable" };

export default TElementCount;
