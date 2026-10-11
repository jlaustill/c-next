import type TConstResult from "./TConstResult";

/**
 * What one enum member's value settled to (#1669, ADR-017 "Member Values"):
 * the evaluator's answer for a value as written, and two answers only an enum
 * has --
 *
 * - `outOfRange`: a value, but not an `i32`'s.
 * - `follows`: written without a value, continuing from a member that has
 *   none. Its own problem is that member's, reported there, not again here.
 */
type TEnumMemberValue =
  | TConstResult
  | { readonly kind: "outOfRange"; readonly value: bigint }
  | { readonly kind: "follows"; readonly member: string };

export default TEnumMemberValue;
