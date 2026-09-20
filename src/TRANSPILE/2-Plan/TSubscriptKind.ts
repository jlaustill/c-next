/**
 * Issue #579: Subscript classification result
 *
 * Discriminates between array access and bit manipulation operations.
 * Used by both assignment and expression paths to ensure consistent behavior.
 */
type TSubscriptKind =
  | "array_element" // Single array element access: arr[i]
  | "array_slice" // Array slice: arr[offset, length] (per-element little-endian writes, ADR-007/#1081)
  | "bit_single" // Single bit access: flags[3]
  | "bit_range"; // Bit range extraction: value[start, width]

export default TSubscriptKind;
