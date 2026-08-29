/**
 * Issue #1241: the source lines at which each ADR's rule fired for one fixture.
 *
 * The matrix resolves a fixture's cell by walking the parse tree at a POSITION.
 * Diagnostic positions come from `.expected.error`, which is why an ADR about
 * resolution SUCCEEDING had no way in: ADR-057's fixtures assert generated C and
 * emit no diagnostic, so eleven of them occupied nothing and seventeen declared
 * cells sat `warn` with no path to green.
 *
 * Transpiling the fixture and reading `result.adrSites` supplies the missing
 * positions from the transpiler's own behaviour. Occupancy stays DERIVED -- the
 * fixture still declares nothing, and a cell is credited only where the rule
 * demonstrably fired.
 */

import { dirname } from "node:path";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Transpiler from "../../src/transpiler/Transpiler";

/** Throwaway output directory; the matrix cares about provenance, not files. */
function scratchDir(): string {
  return mkdtempSync(join(tmpdir(), "cnext-matrix-"));
}

/**
 * ADR number -> lines at which that ADR's rule fired in `fixturePath`.
 *
 * Returns an empty map when the fixture cannot be transpiled. A fixture that
 * fails to transpile is not evidence of anything, and inventing occupancy from
 * a failed run is the same error as trusting a synthetic 1:0 position.
 */
async function forFixture(fixturePath: string): Promise<Map<string, number[]>> {
  const byAdr = new Map<string, number[]>();

  let result;
  try {
    const source = readFileSync(fixturePath, "utf-8");
    const transpiler = new Transpiler({
      input: fixturePath,
      outDir: scratchDir(),
    });
    result = await transpiler.transpile({
      kind: "source",
      source,
      workingDir: dirname(fixturePath),
      sourcePath: fixturePath,
    });
  } catch {
    return byAdr;
  }

  for (const site of result.adrSites ?? []) {
    const lines = byAdr.get(site.adr) ?? [];
    if (!lines.includes(site.line)) {
      lines.push(site.line);
    }
    byAdr.set(site.adr, lines);
  }
  return byAdr;
}

class AdrProvenanceLines {
  static forFixture = forFixture;
}

export default AdrProvenanceLines;
