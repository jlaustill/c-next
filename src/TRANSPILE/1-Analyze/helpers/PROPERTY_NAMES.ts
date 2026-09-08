/**
 * Every property name the language defines on a value's shape or storage.
 *
 * #1322: three rules read this list, from two directions, and they must agree.
 *
 * - ADR-058's four shape properties (`bit_length`, `byte_length`,
 *   `element_count`, `char_count`) and ADR-045's two storage ones (`capacity`,
 *   `size`) are what `LengthPropertyAnalyzer` OWNS -- it decides whether each
 *   is used on a subject that has it.
 * - `length` is here because it is a NAME the language knows and rejects
 *   (ADR-058 deprecated it). Leaving it out would make it look like an
 *   ordinary member and be reported as an unknown one.
 * - ADR-034's unknown-field rule reads the same list to know what is NOT a
 *   bitmap field. Before it was shared, `flags.bit_length` reported
 *   "Unknown bitmap field 'bit_length'" while ADR-058 defined it; with
 *   `capacity` added and this list not, `flags.capacity` would have reported
 *   the same thing INSTEAD of "only available on strings", which is the
 *   message that tells the author what is wrong.
 *
 * One list, so a property added to the language cannot be a shape rule in one
 * analyzer and an unknown member in another.
 */
const PROPERTY_NAMES: ReadonlySet<string> = new Set([
  // ADR-058, shape
  "bit_length",
  "byte_length",
  "element_count",
  "char_count",
  // ADR-045, string storage
  "capacity",
  "size",
  // ADR-058, deprecated and rejected
  "length",
]);

export default PROPERTY_NAMES;
