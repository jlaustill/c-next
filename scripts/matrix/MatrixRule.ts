/**
 * #1731 review: names one matrix -- an ADR's own, or one rule's within it.
 *
 * Occupancy is counted per matrix. While it was counted per ADR, a fixture for
 * one of an ADR's rules filled cells only another rule could vouch for: ADR-045's
 * bounded copy, written across an include, kept the declaration rules' imported
 * cells `ok` with their own fixtures untagged. A rule with its own table gets
 * its own id, and only provenance recorded for that rule occupies it.
 *
 * #1620: a diagnostic code is named the same way ("029 E0879"). One fixture
 * asserting E0880 used to green every cell for E0879 too, because both codes
 * shared ADR-029's matrix; each code now has its own, occupied only by
 * diagnostics carrying that code.
 *
 * The sole encoder of the id, as `MatrixCell.key` is of a cell's.
 */

import DiagnosticManifest from "../diagnostics/DiagnosticManifest";

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

/** Whether a matrix id names one diagnostic code's matrix. */
function isCode(matrixId: string): boolean {
  const rule = ruleOf(matrixId);
  return rule !== null && DiagnosticManifest.isCode(rule);
}

class MatrixRule {
  static id = id;
  static isCode = isCode;
  static adrOf = adrOf;
  static ruleOf = ruleOf;
}

export default MatrixRule;
