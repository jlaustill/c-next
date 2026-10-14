import LengthProperty from "../LengthProperty";

/**
 * Every property name the language defines on a value's shape or storage.
 *
 * #1322: three rules read this list, from two directions, and they must agree.
 *
 * - ADR-058's twelve length properties (`value_bit_length` to
 *   `memory_element_count`, `LengthProperty.NAMES`) and ADR-045's two storage
 *   ones (`capacity`, `size`) are what `LengthPropertyAnalyzer` OWNS -- it
 *   decides whether each is used on a subject that has it.
 * - `length` and the four unprefixed lengths (`bit_length`, ...) are here
 *   because they are NAMES the language knows and rejects (ADR-058 removed
 *   them). Leaving them out would make them look like ordinary members and be
 *   reported as unknown ones, not with the help that names the replacement.
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
  // ADR-058, the kind-named lengths, and the removed unprefixed ones
  ...LengthProperty.NAMES,
  ...LengthProperty.REMOVED.keys(),
  // ADR-045, string storage
  "capacity",
  "size",
  // ADR-058, deprecated and rejected
  "length",
]);

export default PROPERTY_NAMES;
