/**
 * Symbol conflict information for cross-language symbol detection.
 */

import TAnySymbol from "./symbols/TAnySymbol";

interface IConflict {
  symbolName: string;
  definitions: TAnySymbol[];
  severity: "error" | "warning";
  message: string;

  /**
   * Where to report the conflict — the first offending definition.
   *
   * #1334: a conflict used to reach the user through a second, parallel channel.
   * `Transpiler._checkSymbolConflicts` kept only `message`, pushed it onto
   * `result.conflicts: string[]`, and added ONE companion error with no position at a
   * hardcoded `1:0`. The per-definition positions existed on `definitions` the
   * whole time and were simply never carried across.
   *
   * That cost more than tidiness: `FixtureOccupancy.ts:45` skips position `1:0` as
   * a known placeholder, so no symbol-conflict fixture could occupy a
   * scope-context matrix cell, and ADR-016's six declared cells had no path to
   * `error` (adr-016-scope.md, "Scope-Context Matrix").
   */
  readonly sourceFile: string;
  readonly line: number;
  readonly column: number;
}

export default IConflict;
