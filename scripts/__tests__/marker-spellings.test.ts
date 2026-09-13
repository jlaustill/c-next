/**
 * #1555: no fixture writes a marker in a spelling the harness does not read.
 *
 * The no-warnings marker was recognized in block form only, so a fixture
 * spelling it as a line comment -- the way every other marker is written --
 * asked for the warning check and silently did not get one.
 *
 * This is the fifth route to one class: #1143 (the marker compiled with no
 * optimizer, so it could not emit the diagnostic it guarded), #1379
 * (`test-error` is read in no spelling at all), #1553 (wrong include path,
 * then entry-only), #1557 (C mode only). Markers reporting success on a check
 * that never ran.
 *
 * The vocabulary is asked, never restated: a second copy of the spellings here
 * would be a guard that agrees with the harness by coincidence, and would keep
 * agreeing after the harness changed.
 */

import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

import FileScanner from "../utils/FileScanner";
import TestMarkers from "../TestMarkers";

const rootDir = join(__dirname, "..", "..");
const testsDir = join(rootDir, "tests");

describe("fixture markers are written in a spelling the harness reads (#1555)", () => {
  // Every `.cnx`, not just `*.test.cnx`: `generate-cpp-snapshots.ts` asks the
  // vocabulary about HELPER sources too, inside `generateHelperCppSnapshot`.
  // 125 helpers exist and 14 carry `// test-cpp-only`; all are spelled
  // correctly today, so this closes a latent gap rather than a live break --
  // but it is the exact failure this module exists to prevent. A helper
  // writing `/* test-c-only */` would be read by no site AND flagged by no
  // guard, so it would silently receive a C++ snapshot it asked not to have,
  // and a wrong snapshot there is compared forever after.
  const found = FileScanner.findFiles(testsDir, ".cnx");

  it("finds the fixtures at all", () => {
    // Guards the selector. If the walk returns nothing the assertion below
    // passes over an empty list -- a guard that cannot fail (#1297).
    expect(found.length).toBeGreaterThan(500);
  });

  it("knows every marker the harness reads", () => {
    // Guards the vocabulary the same way. An empty or truncated table would
    // make the corpus assertion vacuous rather than failing.
    expect(TestMarkers.names()).toEqual([
      "test-execution",
      "test-error",
      "test-c-only",
      "test-cpp-only",
      "test-transpile-only",
      "test-no-warnings",
      "test-adr",
      "test-link",
    ]);
  });

  it("has no marker line in an unrecognized spelling", () => {
    const offenses: string[] = [];

    for (const file of found) {
      for (const bad of TestMarkers.findUnrecognizedSpellings(
        readFileSync(file, "utf-8"),
      )) {
        offenses.push(`${relative(rootDir, file)}:${bad.line}: ${bad.text}`);
      }
    }

    expect(offenses).toEqual([]);
  });
});
