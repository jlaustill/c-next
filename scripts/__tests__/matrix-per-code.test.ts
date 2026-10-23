/**
 * #1620: a cell is occupied per diagnostic code, not per ADR.
 *
 * ADR-029 declares E0879 and E0880. A fixture asserting only E0880 in a cell
 * used to green that cell for E0879 too, which is how #1619 stayed invisible.
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import AdrDeclarationReader from "../matrix/AdrDeclarationReader";
import FixtureOccupancy from "../matrix/FixtureOccupancy";
import MatrixReport from "../matrix/MatrixReport";

let dir: string;

const write = (name: string, body: string): string => {
  const path = join(dir, name);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, body, "utf-8");
  return path;
};

const ADR = [
  "# ADR-029",
  "",
  "| Code  | Rule              |",
  "| ----- | ----------------- |",
  "| E0879 | signature differs |",
  "| E0880 | nominal type      |",
  "",
  ...["E0879", "E0880"].flatMap((code) => [
    `<!-- MATRIX-SEVERITY code: ${code} -->`,
    "",
    "| Context            | Relationship | Severity |",
    "| ------------------ | ------------ | -------- |",
    "| top-level function | same file    | error    |",
    "",
  ]),
].join("\n");

const FIXTURE = "// test-adr: 029\nvoid go() {\n    u32 x <- 1;\n}\n";

async function violationsFor(expectedError: string) {
  write("decisions/adr-029-function-pointers.md", ADR);
  const fixture = write("tests/cb.test.cnx", FIXTURE);
  write("tests/cb.expected.error", expectedError);
  const declarations = AdrDeclarationReader.read(join(dir, "decisions"));
  const occupancy = await FixtureOccupancy.build([fixture], join(dir, "tests"));
  return MatrixReport.violations(declarations, occupancy);
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "cnx-matrix-code-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("per-code matrix occupancy (#1620)", () => {
  it("reports the declared code no fixture asserts in a cell another code occupies", async () => {
    const found = await violationsFor("3:4 error[E0880]: nominal\n");
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      adr: "029 E0879",
      context: "top-level-function",
      relationship: "same-file",
      severity: "error",
    });
  });

  it("reports nothing once every declared code is asserted in the cell", async () => {
    const found = await violationsFor(
      "3:4 error[E0880]: nominal\n3:4 error[E0879]: signature\n",
    );
    expect(found).toEqual([]);
  });
});
