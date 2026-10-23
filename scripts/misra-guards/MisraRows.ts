/**
 * The guideline rows of docs/misra-compliance.md, read once for every script
 * that derives something from them: the summary counts (#1143) and the guard
 * registry check (#1610).
 */

import MISRA_STATUSES from "./MISRA_STATUSES";
import type IMisraRow from "./types/IMisraRow";

const ROW = /^\|\s*(Dir\s*\d+\.\d+|\d+\.\d+)\s*\|[^|]*\|([^|]*)\|([^|]*)\|/;
const GENERATED_BLOCK =
  /<!-- BEGIN GENERATED: ([\w-]+) -->[\s\S]*?<!-- END GENERATED: \1 -->/g;

class MisraRows {
  /**
   * Every guideline's row, first occurrence wins. Generated regions are
   * skipped: their rows restate guidelines, so counting them would count a
   * guideline twice.
   */
  static parse(document: string): IMisraRow[] {
    const rows: IMisraRow[] = [];
    const seen = new Set<string>();
    for (const line of document.replace(GENERATED_BLOCK, "").split("\n")) {
      const match = ROW.exec(line);
      if (match === null) continue;
      const id = match[1]!.replace(/\s+/g, " ").trim();
      if (seen.has(id)) continue;
      const cell = match[2]!.trim().replace(/\*/g, "");
      const status = MISRA_STATUSES.find((candidate) =>
        cell.startsWith(candidate),
      );
      if (status === undefined) continue;
      seen.add(id);
      rows.push({ id, status, reference: match[3]!.trim() });
    }
    return rows;
  }
}

export default MisraRows;
