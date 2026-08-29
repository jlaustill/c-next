/**
 * Symbol conflict information for cross-language symbol detection.
 */

import TAnySymbol from "./symbols/TAnySymbol";

interface IConflict {
  /**
   * The diagnostic code this conflict reports under, without brackets --
   * `"E0425"` for a symbol conflict, `"E0204"` for MISRA Rule 5.1.
   *
   * A union, not `string`, for the reason the sibling `severity` field gives:
   * it is interpolated straight into `error[${conflict.code}]`, so as `string`
   * the values `"E425"`, `"e0204"` and `""` would all typecheck. The corpus pins
   * the two existing codes through their `.expected.error` files, but a typo in a
   * FUTURE producer would render into a fresh snapshot that `--update` accepts
   * silently (#1316). Extend the union when a third conflict code appears.
   *
   * On the conflict, not on the consumer. #1342 hardcoded `error[E0425]` at the
   * point of consumption, and #1339 landed a second producer whose code is
   * E0204 -- so the two merged into a state where the code a conflict reports
   * under depended on which consumer happened to read it. One producer knows
   * its own code; no consumer should be guessing.
   */
  readonly code: "E0204" | "E0425";

  symbolName: string;
  definitions: TAnySymbol[];
  /**
   * Always `"error"`.
   *
   * #1334 review: the message prefix is a hardcoded `error[E0425]`, so a
   * warning-severity conflict would print as an error, go through ResultPrinter's
   * `Error:` prefix, and still leave `result.success` true. Both producers return
   * `"error"`, so that agreed with the truth only by coincidence. Narrowing the type
   * makes it agree by construction; widen it again only alongside a prefix derived
   * from this field.
   */
  severity: "error";
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
