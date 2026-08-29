import { existsSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import FileScanner from "../utils/FileScanner";
import IManifestEntry from "../types/IManifestEntry";
import IManifestFailure from "../types/IManifestFailure";

/**
 * The committed record of which fixtures assert which diagnostics (issue #1316).
 *
 * A `.expected.error` is the only assertion that a diagnostic fires. Nothing
 * previously noticed one going away: `--update` unlinked it and reported the run
 * green, and even by hand a deletion is a removed file, which reads as tidying.
 * The manifest turns both into a diff a reviewer has to approve.
 */
class DiagnosticManifest {
  /** Matches the `error[E0902]` / `error[MISRA-3.1]` tag the transpiler emits. */
  private static readonly CODE_PATTERN_SOURCE = "error\\[([^\\]]+)\\]";

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
