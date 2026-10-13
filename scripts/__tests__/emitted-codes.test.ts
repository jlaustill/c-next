import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import EmittedCodes from "../diagnostics/EmittedCodes";
import SourceModule from "../utils/SourceModule";

/**
 * #1827 review: `error-codes.ts` skipped `__tests__/` alone, so an `E####` in
 * a `__testUtils__/` double failed `error-codes:check` as an emitted code. The
 * oracle spells "test code" itself rather than asking `SourceModule`: a
 * predicate graded against itself passes whatever it says.
 */
const inTests = (path: string) => path.includes("/__tests__/");
const inTestUtils = (path: string) => path.includes("/__testUtils__/");
const isTestFile = (path: string) => path.endsWith(".test.ts");

const at = (path: string) => join(SourceModule.rootDir, path);

describe("EmittedCodes", () => {
  // One file per arm: dropping any exclusion lets its code in.
  const files = new Map([
    [at("src/cnx/Emitter.ts"), 'throw new Error("E9991: real")'],
    [at("src/cnx/__tests__/Emitter.test.ts"), 'code: "E9992"'],
    [at("src/cnx/types/__testUtils__/Double.ts"), 'code: "E9993"'],
    [at("src/cnx/Stray.test.ts"), 'code: "E9994"'],
  ]);

  it("leaves out every kind of test code", () => {
    expect([...EmittedCodes.collect(files, new Set())]).toEqual(["E9991"]);
  });

  it("keeps a test-owned code the registry attributes to a test", () => {
    expect([...EmittedCodes.collect(files, new Set(["E9992"]))].sort()).toEqual(
      ["E9991", "E9992"],
    );
  });

  it("counts a row naming any test directory as test-owned", () => {
    // Row sources are relative to src/cnx/; E9991 is the non-test control.
    const markdown = [
      "| E0000 | Generic | `TRANSPILE/1-Analyze/types/__tests__/I.test.ts` |",
      "| E9993 | Double | `types/__testUtils__/Double.ts` |",
      "| E9991 | Real | `Emitter.ts` |",
    ].join("\n");
    expect([...EmittedCodes.testOwned(markdown)].sort()).toEqual([
      "E0000",
      "E9993",
    ]);
  });

  it("reads exactly the codes in the non-test modules of src/", () => {
    const tracked = execFileSync("git", ["ls-files", "--", "src/*.ts"], {
      encoding: "utf-8",
    })
      .split("\n")
      .filter((path) => path.length > 0);
    // Each exclusion has files to exclude on this tree.
    expect(tracked.some(inTests)).toBe(true);
    expect(tracked.some(inTestUtils)).toBe(true);

    const expected = new Set<string>();
    for (const path of tracked) {
      if (inTests(path) || inTestUtils(path) || isTestFile(path)) continue;
      for (const match of readFileSync(at(path), "utf-8").matchAll(
        /\bE\d{4}\b/g,
      )) {
        expected.add(match[0]);
      }
    }
    expect([...EmittedCodes.read(new Set())].sort()).toEqual(
      [...expected].sort(),
    );
  });
});
