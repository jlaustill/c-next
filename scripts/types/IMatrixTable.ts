/**
 * Issue #1620: one table an ADR declares besides its own, named by its marker.
 * `rule` tables are occupied by a rule's provenance, `code` tables by fixtures
 * asserting that diagnostic code.
 */
interface IMatrixTable {
  readonly kind: "rule" | "code";
  readonly name: string;
}

export default IMatrixTable;
