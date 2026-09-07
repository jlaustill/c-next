/**
 * The four properties ADR-058 defines on a value's shape.
 *
 * #1322: shared because two rules must agree on the list, from opposite
 * directions. ADR-058's own rule (E0867) asks whether a property name is one
 * of these; ADR-034's unknown-field rule (E0882) asks whether a member of a
 * bitmap is NOT a declared field, and must not report one of these -- they are
 * properties of the type's shape rather than fields of the bitmap. A second
 * copy would let a property be added to one list and rejected by the other,
 * which is precisely what happened before this was shared: `flags.bit_length`
 * reported "Unknown bitmap field 'bit_length'" while ADR-058 defined it.
 */
const LENGTH_PROPERTIES: ReadonlySet<string> = new Set([
  "bit_length",
  "byte_length",
  "element_count",
  "char_count",
]);

export default LENGTH_PROPERTIES;
