/**
 * Issue #1219: per-ADR occupancy built from the fixture corpus.
 *
 * The claim under test is that a cell is occupied only when a fixture really
 * exercises it. The cases that matter are the ones where a plausible
 * implementation would over-claim: a fixture holding two contexts, and a
 * diagnostic with no usable position.
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import FixtureOccupancy from "../matrix/FixtureOccupancy";
import MatrixCell from "../matrix/MatrixCell";

let dir: string;

const write = (name: string, body: string): string => {
  const path = join(dir, name);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, body, "utf-8");
  return path;
};

const occupancyFor = (adr: string, fixtures: string[]) =>
  FixtureOccupancy.build(fixtures, dir).get(adr);

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "cnx-matrix-occ-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("FixtureOccupancy.build", () => {
  it("ignores a fixture with no test-adr marker", () => {
    const fixture = write("plain.test.cnx", "u8 x <- 1;\n");
    expect(FixtureOccupancy.build([fixture], dir).size).toBe(0);
  });

  it("places an error fixture in the cell its diagnostic resolves to", () => {
    const fixture = write(
      "division.test.cnx",
      "// test-adr: 051\nconst u32 ZERO <- 0;\nvoid go() {\n    u32 bad <- 10 / ZERO;\n}\n",
    );
    write("division.expected.error", "4:22 error[E0800]: Division by zero\n");

    const occupancy = occupancyFor("051", [fixture]);
    expect([...occupancy!.cells.keys()]).toEqual([
      MatrixCell.key("top-level-function", "same-file"),
    ]);
  });

  it("uses the include graph for the relationship, not just the context", () => {
    write("provider.cnx", "const u32 ZERO <- 0;\n");
    const fixture = write(
      "consumer.test.cnx",
      '// test-adr: 051\n#include "provider.cnx"\nvoid go() {\n    u32 bad <- 10 / ZERO;\n}\n',
    );
    write("consumer.expected.error", "4:22 error[E0800]: Division by zero\n");

    const occupancy = occupancyFor("051", [fixture]);
    expect([...occupancy!.cells.keys()]).toEqual([
      MatrixCell.key("top-level-function", "imported-direct"),
    ]);
  });

  it("does not credit a context the fixture merely contains", () => {
    // The fixture declares BOTH a scope and a top-level function, but the
    // diagnostic is inside the scope method. Only that cell may be occupied --
    // a file-structure derivation would claim both.
    const fixture = write(
      "both.test.cnx",
      [
        "// test-adr: 051",
        "const u32 ZERO <- 0;",
        "void topLevel() {",
        "    u32 fine <- 1;",
        "}",
        "scope S {",
        "    void go() {",
        "        u32 bad <- 10 / ZERO;",
        "    }",
        "}",
      ].join("\n"),
    );
    write("both.expected.error", "8:24 error[E0800]: Division by zero\n");

    const occupancy = occupancyFor("051", [fixture]);
    expect([...occupancy!.cells.keys()]).toEqual([
      MatrixCell.key("scope-method", "same-file"),
    ]);
  });

  it("records a fixture with no diagnostic as context-not-derivable", () => {
    const fixture = write(
      "positive.test.cnx",
      "// test-adr: 049\nu8 x <- 1;\n",
    );
    const occupancy = occupancyFor("049", [fixture]);
    expect(occupancy!.cells.size).toBe(0);
    expect(occupancy!.fixturesWithoutContext).toEqual(["positive.test.cnx"]);
  });

  it("treats a synthetic 1:0 diagnostic as no position, not as line 1", () => {
    // #1235: 13 codes report 1:0 as a placeholder. Resolving line 1 would
    // classify them by whatever declaration happens to start the file.
    // Line 1 must be a real DECLARATION for this to discriminate. With a
    // comment on line 1 the classifier returns null either way and the test
    // cannot tell whether the exclusion is doing anything.
    const fixture = write(
      "synthetic.test.cnx",
      "u32 leading <- 1;\n// test-adr: 070\nvoid go() {\n    u32 x <- 1;\n}\n",
    );
    write(
      "synthetic.expected.error",
      "1:0 Code generation failed: E0853: Cannot use 'return' inside critical section\n",
    );

    const occupancy = occupancyFor("070", [fixture]);
    expect(occupancy!.cells.size).toBe(0);
    expect(occupancy!.fixturesWithoutContext).toEqual(["synthetic.test.cnx"]);
  });

  it("credits every ADR a fixture declares", () => {
    const fixture = write(
      "multi.test.cnx",
      "// test-adr: 051, 013\nvoid go() {\n    u32 bad <- 1;\n}\n",
    );
    write("multi.expected.error", "3:14 error[E0800]: Division by zero\n");

    const report = FixtureOccupancy.build([fixture], dir);
    expect([...report.keys()]).toEqual(["013", "051"]);
  });
});
