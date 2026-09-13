/**
 * Reads the project board's `Blocked by` field.
 *
 * The field is FREE TEXT, append-only and never cleared (docs/WORKFLOW.md), so
 * what it holds is prose with references in it:
 *
 *     #1320, #1322, #1447; #1398 -- box 3 requires #1430 AND #1398 fixed by
 *     the hoist ... closed 2026-09-05 via PR #1502 ...
 *
 * The blockers are the LEADING `#n[, #n]*` run of each `;`-separated segment.
 * Everything from the first non-reference token onward is commentary about why
 * the card is blocked, and the issues it cites are not blockers.
 *
 * This distinction is the whole module. Measured across the 21 Backlog cards on
 * 2026-09-12, a bare `#\d+` scan invented five edges: `#1511` on #1544, whose
 * own field says *"is closed and is no longer a blocker"*, and `#1502`, `#1496`
 * and `#1560` on #1448, all three citations inside an explanation of why a
 * definition-of-done box is unsatisfiable. Ordering a column on those edges
 * produces a different, wrong answer with nothing failing.
 */
class BlockedByField {
  /** `#n`, or `#n, #n, ...`, anchored at the start of a segment. */
  private static readonly LEADING_RUN = /^\s*#\d+(?:\s*,\s*#\d+)*/;

  private static readonly REFERENCE = /#(\d+)/g;

  /**
   * The issue numbers this field names as blockers, in the order it names them.
   *
   * Deduplicated: a field that re-states a blocker in a later appended segment
   * (#1448 names #1430 twice) means it once, and an edge repeated would inflate
   * the constraint count without changing the order.
   */
  static parse(text: string): number[] {
    const found: number[] = [];
    for (const segment of text.split(";")) {
      const leading = BlockedByField.LEADING_RUN.exec(segment);
      if (leading === null) {
        continue;
      }
      for (const match of leading[0].matchAll(BlockedByField.REFERENCE)) {
        const issue = Number(match[1]);
        if (!found.includes(issue)) {
          found.push(issue);
        }
      }
    }
    return found;
  }

  /**
   * References the field mentions that `parse` does NOT treat as blockers.
   *
   * Reporting only -- it is what lets a run say which citations it declined,
   * so a wrong parse is visible in the log rather than only in the result.
   */
  static citations(text: string): number[] {
    const blockers = BlockedByField.parse(text);
    const cited: number[] = [];
    for (const match of text.matchAll(BlockedByField.REFERENCE)) {
      const issue = Number(match[1]);
      if (!blockers.includes(issue) && !cited.includes(issue)) {
        cited.push(issue);
      }
    }
    return cited;
  }
}

export default BlockedByField;
