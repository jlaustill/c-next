/**
 * #1731 review: names one matrix -- an ADR's own, or one rule's within it.
 *
 * Occupancy is counted per matrix. While it was counted per ADR, a fixture for
 * one of an ADR's rules filled cells only another rule could vouch for: ADR-045's
 * bounded copy, written across an include, kept the declaration rules' imported
 * cells `ok` with their own fixtures untagged. A rule with its own table gets
 * its own id, and only provenance recorded for that rule occupies it.
 *
 * The sole encoder of the id, as `MatrixCell.key` is of a cell's.
 */

/** "045" for the ADR's own matrix, "045 string-copy" for a rule's. */
function id(adr: string, rule?: string | null): string {
  return rule ? `${adr} ${rule}` : adr;
}

/** The ADR a matrix id belongs to. */
function adrOf(matrixId: string): string {
  return matrixId.split(" ")[0];
}

/** The rule a matrix id names, or null for the ADR's own matrix. */
function ruleOf(matrixId: string): string | null {
  const space = matrixId.indexOf(" ");
  return space === -1 ? null : matrixId.slice(space + 1);
}

class MatrixRule {
  static id = id;
  static adrOf = adrOf;
  static ruleOf = ruleOf;
}

export default MatrixRule;
