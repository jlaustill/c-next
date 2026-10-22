/**
 * #1975: why a header struct's members do not sum to its length. cnx sizes
 * a struct by adding up its fields (ADR-058), so a struct whose members share
 * storage, pack into bits, hide behind an unnamed member, or carry storage C++
 * adds (a base, a vtable) has no length.
 */
type TStructLayout =
  | "union"
  | "bit-packed"
  | "unrecorded-member"
  | "derived"
  | "virtual";

export default TStructLayout;
