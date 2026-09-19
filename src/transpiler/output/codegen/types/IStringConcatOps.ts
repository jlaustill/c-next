/**
 * Operands of a string concatenation, as generated C expressions plus the
 * capacities the copy has to fit into.
 *
 * `left` and `right` hold generated code, not values -- `a + b` yields "a" and
 * "b", and either may be an arbitrary expression. The capacities are byte
 * counts known at compile time, which is what lets the emitted `strncpy`/
 * `strncat` pair be bounded rather than trusting the source.
 *
 * Extracted for the same reason as its sibling `ISubstringOps`, whose own doc
 * records it: "the same four fields were declared in four places and any change
 * to one of them needed four edits". This shape was declared THREE times --
 * `StringOperationsHelper` (which produces it), `StringDeclHelper` and
 * `VariableDeclHelper` (which each name it in a callback signature) -- all
 * byte-identical, so the rule was being followed for one of the two operand
 * types and not the other. CLAUDE.md: "If two interfaces need the same fields,
 * extract a shared type."
 */
interface IStringConcatOps {
  /** Generated C expression for the left operand */
  left: string;
  /** Generated C expression for the right operand */
  right: string;
  /** Capacity of the left operand in bytes, known at compile time */
  leftCapacity: number;
  /** Capacity of the right operand in bytes, known at compile time */
  rightCapacity: number;
}

export default IStringConcatOps;
