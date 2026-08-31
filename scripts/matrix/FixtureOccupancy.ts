/**
 * Issue #1219: builds per-ADR matrix occupancy from the fixture corpus.
 *
 * Occupancy is derived, never declared. A fixture states only which ADR it
 * exercises (`// test-adr:`); which cell that lands in comes from the parse
 * tree and the include graph, so the classification cannot drift from the
 * fixture -- it IS the fixture.
 */

import { existsSync, readFileSync } from "node:fs";
import { relative } from "node:path";

import CNextSourceParser from "../../src/transpiler/logic/parser/CNextSourceParser";
import FixtureContext from "./FixtureContext";
import IncludeDepth from "./IncludeDepth";
import MatrixCell from "./MatrixCell";
import TestUtils from "../test-utils";
import AdrProvenanceLines from "./AdrProvenanceLines";
import IMatrixOccupancy from "../types/IMatrixOccupancy";
import TMatrixContext from "../types/TMatrixContext";

/**
 * Source lines carrying a diagnostic, from a fixture's `.expected.error`.
 *
 * Position `1:0` is excluded: 13 error codes report it as a placeholder while
 * the real line sits in the message text or is lost entirely at the catch
 * (#1235). Resolving line 1 would classify every one of them as whatever
 * declaration happens to start the file.
 *
 * This does discard the rare genuine diagnostic at line 1 column 0. That is the
 * safe direction: the cost is an under-reported cell, whereas trusting the
 * placeholder invents occupancy for a cell nothing exercises. Once #1235 lands
 * the position is unambiguous and this exclusion should go.
 *
 * KNOWN GAP (#1408): the path prefix is discarded, so a position naming ANOTHER
 * file is still resolved against this fixture's parse tree. Harmless today --
 * the one fixture that reports a foreign path (#1334's cross-file conflict,
 * which reports at the FIRST definition) lands on a comment and yields no
 * context -- but there is no guard, and every diagnostic that gains a real
 * cross-file position turns a skipped 1:0 into a real number aimed at the wrong
 * tree.
 */
function diagnosticLines(expectedErrorPath: string): number[] {
  if (!existsSync(expectedErrorPath)) return [];

  const lines: number[] = [];
  const content = readFileSync(expectedErrorPath, "utf-8");
  const pattern = /^(\d+):(\d+)/gm;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    const line = Number(match[1]);
    const column = Number(match[2]);
    if (line === 1 && column === 0) continue;
    if (!lines.includes(line)) lines.push(line);
  }
  return lines;
}

/** Contexts the given source lines resolve to. Empty when none can be. */
function contextsAt(
  source: string,
  lines: readonly number[],
): TMatrixContext[] {
  if (lines.length === 0) return [];

  const { tree } = CNextSourceParser.parse(source);
  const contexts: TMatrixContext[] = [];
  for (const line of lines) {
    const context = FixtureContext.at(tree, line);
    if (context !== null && !contexts.includes(context)) contexts.push(context);
  }
  return contexts;
}

/** Contexts a fixture's diagnostics resolve to. Empty when none can be. */
function contextsOf(fixturePath: string, source: string): TMatrixContext[] {
  const expectedError = fixturePath.replace(/\.test\.cnx$/, ".expected.error");
  return contextsAt(source, diagnosticLines(expectedError));
}

/**
 * Fold one fixture into the per-ADR occupancy maps.
 */
function recordFixture(
  fixturePath: string,
  testsDir: string,
  searchPaths: readonly string[],
  cells: Map<string, Map<string, string[]>>,
  withoutContext: Map<string, string[]>,
  provenance: ReadonlyMap<string, number[]>,
): void {
  let source: string;
  try {
    source = readFileSync(fixturePath, "utf-8");
  } catch {
    return;
  }

  const adrs = TestUtils.findAdrReferences(source);
  if (adrs.length === 0) return;

  const relationship = MatrixCell.relationshipForDepth(
    IncludeDepth.maxDepth(fixturePath, searchPaths),
  );
  const shortPath = relative(testsDir, fixturePath);

  // #1241: a diagnostic's position is ADR-agnostic -- a fixture's `.expected.error`
  // speaks for every ADR it is tagged with. Provenance is not: it records WHICH
  // rule fired where, so contexts are resolved per ADR rather than once per file.
  const expectedError = fixturePath.replace(/\.test\.cnx$/, ".expected.error");
  const diagnostics = diagnosticLines(expectedError);

  for (const adr of adrs) {
    const lines = [...diagnostics];
    for (const line of provenance.get(adr) ?? []) {
      if (!lines.includes(line)) lines.push(line);
    }
    const contexts = contextsAt(source, lines);

    if (contexts.length === 0) {
      const pending = withoutContext.get(adr) ?? [];
      pending.push(shortPath);
      withoutContext.set(adr, pending);
      continue;
    }

    const adrCells = cells.get(adr) ?? new Map<string, string[]>();
    for (const context of contexts) {
      const key = MatrixCell.key(context, relationship);
      const occupants = adrCells.get(key) ?? [];
      if (!occupants.includes(shortPath)) occupants.push(shortPath);
      adrCells.set(key, occupants);
    }
    cells.set(adr, adrCells);
  }
}

/** Build occupancy for every ADR referenced by any fixture under `testsDir`. */
async function build(
  fixturePaths: readonly string[],
  testsDir: string,
  searchPaths: readonly string[] = [],
): Promise<Map<string, IMatrixOccupancy>> {
  const cells = new Map<string, Map<string, string[]>>();
  const withoutContext = new Map<string, string[]>();

  for (const fixturePath of fixturePaths) {
    // #1241: only tagged fixtures are transpiled -- provenance is the expensive
    // input, and an untagged fixture contributes to no ADR's occupancy anyway.
    let source: string;
    try {
      source = readFileSync(fixturePath, "utf-8");
    } catch {
      continue;
    }
    const provenance = TestUtils.findAdrReferences(source).length
      ? await AdrProvenanceLines.forFixture(fixturePath)
      : new Map<string, number[]>();

    recordFixture(
      fixturePath,
      testsDir,
      searchPaths,
      cells,
      withoutContext,
      provenance,
    );
  }

  const result = new Map<string, IMatrixOccupancy>();
  const adrs = new Set([...cells.keys(), ...withoutContext.keys()]);
  for (const adr of [...adrs].sort()) {
    result.set(adr, {
      adr,
      cells: cells.get(adr) ?? new Map<string, string[]>(),
      fixturesWithoutContext: withoutContext.get(adr) ?? [],
    });
  }
  return result;
}

class FixtureOccupancy {
  static diagnosticLines = diagnosticLines;
  static contextsOf = contextsOf;
  static contextsAt = contextsAt;
  static build = build;
}

export default FixtureOccupancy;
