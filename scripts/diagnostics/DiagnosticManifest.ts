import { existsSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import FileScanner from "../utils/FileScanner";
import IManifestEntry from "../types/IManifestEntry";
import IManifestFailure from "../types/IManifestFailure";
import IManifestOutcome from "../types/IManifestOutcome";

/**
 * The committed record of which fixtures assert which diagnostics (issue #1316).
 *
 * A `.expected.error` is the only assertion that a diagnostic fires. Nothing
 * previously noticed one going away: `--update` unlinked it and reported the run
 * green, and even by hand a deletion is a removed file, which reads as tidying.
 * The manifest turns both into a diff a reviewer has to approve.
 */
class DiagnosticManifest {
  /**
   * Matches every code-carrying shape the corpus emits, not just one of them.
   *
   * Four forms exist, and a bracket-only pattern saw a single one -- leaving 39
   * of the 155 fixtures it recorded as `(uncoded)` actually asserting a code, so
   * `code-removed` could never fire for any of them:
   *
   *     error[E0902]:                          matched before
   *     error[MISRA-3.1]:                      matched before
   *     Code generation failed: Error[E0602]:   missed
   *     Code generation failed: Error E0702:    missed
   *     Code generation failed: E0504:          missed
   *
   * The trailing `:` is what keeps this from over-matching a message body: every
   * code-carrying line in the corpus writes its code as a tag ending in `:`, and
   * stripping each file's own tag leaves zero stray `E####` anywhere in `tests/`.
   */
  private static readonly CODE_PATTERN_SOURCE =
    "(?:(?:error|Error) ?\\[?)?\\b(E[0-9]{4}|MISRA-[0-9.]+)\\b\\]?:";

  /** Shown in place of a code list for a fixture whose diagnostic carries none. */
  private static readonly UNCODED = "(uncoded)";

  private static readonly HEADER = [
    "<!-- GENERATED FILE - DO NOT EDIT.",
    "     Source: every .expected.error under tests/.",
    "     Regenerate: npm run diagnostics:manifest -->",
    "",
    "# Diagnostic Manifest",
    "",
    "Every fixture that asserts a diagnostic, and the codes it asserts. This file",
    "exists so that losing an assertion is a reviewable diff rather than a silent",
    "deletion -- `npm run diagnostics:manifest:check` fails when a listed fixture",
    "loses its `.expected.error`, or stops asserting a code listed here.",
    "",
    "Removing a diagnostic on purpose means deleting its row in the same commit.",
    "Adding one, or promoting `(uncoded)` to a real code, never fails the gate.",
    "",
  ].join("\n");

  /**
   * The diagnostic codes an `.expected.error` body asserts, deduplicated and
   * sorted so the manifest diff reflects a real change rather than line order.
   */
  static parseCodes(body: string): string[] {
    // A fresh RegExp per call rather than one shared /g instance: lastIndex is
    // stateful, so a shared pattern would carry a position between fixtures --
    // and a throw mid-loop would leave it carrying one indefinitely.
    const pattern = new RegExp(DiagnosticManifest.CODE_PATTERN_SOURCE, "g");
    const codes = new Set<string>();
    let match = pattern.exec(body);
    while (match !== null) {
      codes.add(match[1]);
      match = pattern.exec(body);
    }
    return [...codes].sort((a, b) => a.localeCompare(b));
  }

  /**
   * Every `.expected.error` under `tests/`, named by the fixture it belongs to
   * and sorted so the committed file has an order independent of the walk.
   */
  static collect(rootDir: string): IManifestEntry[] {
    const testsDir = join(rootDir, "tests");
    if (!existsSync(testsDir)) {
      return [];
    }
    return FileScanner.findFiles(testsDir, ".expected.error")
      .map((path) => ({
        fixture: relative(rootDir, path)
          .split(sep)
          .join("/")
          .replace(/\.expected\.error$/, ".test.cnx"),
        codes: DiagnosticManifest.parseCodes(readFileSync(path, "utf-8")),
      }))
      .sort((a, b) => a.fixture.localeCompare(b.fixture));
  }

  /** The manifest as committed Markdown. Carries no timestamp, by #1150. */
  static render(entries: readonly IManifestEntry[]): string {
    const rows = entries.map(
      (entry) =>
        `| ${entry.fixture} | ${entry.codes.length > 0 ? entry.codes.join(", ") : DiagnosticManifest.UNCODED} |`,
    );
    const coded = entries.filter((entry) => entry.codes.length > 0).length;
    return [
      DiagnosticManifest.HEADER,
      `${entries.length} fixture(s) assert a diagnostic; ${coded} carry a code.`,
      "",
      "| Fixture | Codes |",
      "| --- | --- |",
      ...rows,
      "",
    ].join("\n");
  }

  /** Reads back a rendered manifest. Must be lossless against `render`. */
  static parse(markdown: string): IManifestEntry[] {
    const entries: IManifestEntry[] = [];
    for (const line of markdown.split("\n")) {
      const cells = DiagnosticManifest.tableCells(line);
      if (cells === null || cells[0] === "Fixture") {
        continue;
      }
      entries.push({
        fixture: cells[0],
        codes:
          cells[1] === DiagnosticManifest.UNCODED
            ? []
            : cells[1].split(",").map((code) => code.trim()),
      });
    }
    return entries;
  }

  /**
   * The two cells of a manifest row, or null for any other line -- prose, the
   * header comment, and the `| --- |` separator alike.
   */
  private static tableCells(line: string): [string, string] | null {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) {
      return null;
    }
    const cells = trimmed
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim());
    if (cells.length !== 2 || /^-+$/.test(cells[0])) {
      return null;
    }
    return [cells[0], cells[1]];
  }

  /** Describes a `check` run without performing any of its I/O. */
  static checkOutcome(
    committedDocument: string | null,
    current: readonly IManifestEntry[],
    freshDocument: string,
  ): IManifestOutcome {
    if (committedDocument === null) {
      return {
        ok: false,
        errors: [
          "docs/diagnostic-manifest.md is missing. Run: npm run diagnostics:manifest",
        ],
        warnings: [],
        info: [],
      };
    }

    const failures = DiagnosticManifest.diff(
      DiagnosticManifest.parse(committedDocument),
      current,
    );
    if (failures.length > 0) {
      return {
        ok: false,
        errors: [
          `${failures.length} fixture(s) no longer assert what the manifest records:`,
          ...failures.map(
            (failure) =>
              `  ${failure.fixture}: ${failure.detail} [${failure.reason}]`,
          ),
          // Regeneration first: a rename presents as `assertion-removed`, and it
          // is the commoner cause. Advising row deletion first would turn a
          // rename into the real loss the gate exists to catch.
          "\nIf the fixture was renamed or moved, regenerate: npm run diagnostics:manifest",
          "If the diagnostic was removed on purpose, delete its row from",
          "docs/diagnostic-manifest.md in the same commit so the loss is reviewed.",
        ],
        warnings: [],
        info: [],
      };
    }

    if (committedDocument !== freshDocument) {
      // Growth alone reaches here: a new fixture or a promoted code. Not a
      // failure of the guard, but the committed file must track it or the next
      // real shrinkage diffs against a stale baseline.
      return {
        ok: false,
        errors: [
          "docs/diagnostic-manifest.md is stale. Run: npm run diagnostics:manifest",
        ],
        warnings: [],
        info: [],
      };
    }

    // Say what was enforced, not just that nothing failed. An identical line for
    // 287 fixtures and for zero is what would let a silently-emptied manifest
    // pass unremarked in a CI log.
    const coded = current.filter((entry) => entry.codes.length > 0).length;
    return {
      ok: true,
      errors: [],
      warnings: [],
      info: [
        `Diagnostic manifest is satisfied (${current.length} fixture(s) asserting a diagnostic, ${coded} coded)`,
      ],
    };
  }

  /**
   * Describes a `write` run: regenerating is the reflex `check` trains, so an
   * assertion it is about to erase has to be named at the moment it happens
   * rather than left to a one-line diff inside a GENERATED-FILE header.
   */
  static writeOutcome(
    committedDocument: string | null,
    current: readonly IManifestEntry[],
  ): IManifestOutcome {
    const lost =
      committedDocument === null
        ? []
        : DiagnosticManifest.diff(
            DiagnosticManifest.parse(committedDocument),
            current,
          );
    return {
      ok: true,
      errors: [],
      warnings: lost.map(
        (failure) => `  dropped ${failure.fixture}: ${failure.detail}`,
      ),
      info: [],
    };
  }

  /**
   * The ways `current` shrank against `committed`.
   *
   * Growth is never a failure: a fixture that gains a code, or a wholly new
   * fixture, is the behavior the gate exists to encourage. Only loss is
   * reported, so a diagnostic migration is not blocked by its own guard.
   */
  static diff(
    committed: readonly IManifestEntry[],
    current: readonly IManifestEntry[],
  ): IManifestFailure[] {
    const currentByFixture = new Map(
      current.map((entry) => [entry.fixture, entry]),
    );

    const failures: IManifestFailure[] = [];
    for (const entry of committed) {
      const now = currentByFixture.get(entry.fixture);
      if (now === undefined) {
        failures.push({
          fixture: entry.fixture,
          reason: "assertion-removed",
          detail: "no .expected.error on disk",
        });
        continue;
      }

      const stillAsserted = new Set(now.codes);
      const lost = entry.codes.filter((code) => !stillAsserted.has(code));
      if (lost.length > 0) {
        failures.push({
          fixture: entry.fixture,
          reason: "code-removed",
          detail: `no longer asserts ${lost.join(", ")}`,
        });
      }
    }
    return failures;
  }
}

export default DiagnosticManifest;
