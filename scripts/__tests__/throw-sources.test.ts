import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import ThrowSources from "../diagnostics/ThrowSources";

/**
 * #1531: the throw corpus is every hand-written, non-test `.ts` under `src/`.
 *
 * The oracle here spells ANTLR's mark itself rather than importing the one
 * `ThrowSources` uses: a predicate graded against itself passes whatever it
 * says.
 */
const GENERATED = /^\/\/ Generated from .* by ANTLR/;

const tracked = execFileSync("git", ["ls-files", "--", "src/*.ts"], {
  encoding: "utf-8",
})
  .split("\n")
  .filter((path) => path.length > 0);

describe("ThrowSources (#1531)", () => {
  const corpus = ThrowSources.read();

  it("reaches every layer of src/, not one pass", () => {
    const layers = [
      "src/utils/invariant.ts",
      "src/cli/Transpiler.ts",
      "src/PARSE/1-Discover/Discover.ts",
      "src/TRANSPILE/1-Analyze/runAnalyzers.ts",
      "src/TRANSPILE/3-Render/codegen/CodeGenerator.ts",
    ];
    expect(layers.filter((path) => !corpus.has(path))).toEqual([]);
  });

  it("leaves out exactly the tests and the files ANTLR generated", () => {
    const isTest = (path: string) => path.includes("/__tests__/");
    const isGenerated = (path: string) =>
      GENERATED.test(readFileSync(path, "utf-8"));

    // One control per arm: each exclusion has something to exclude, so
    // dropping either arm would put files in the corpus and fail below.
    expect(tracked.some(isTest)).toBe(true);
    expect(tracked.some(isGenerated)).toBe(true);

    // Both ways: a file is in the corpus exactly when it is neither. A third
    // kind of exclusion, or a generated file kept, shows up by name.
    const wrong = tracked.filter(
      (path) => corpus.has(path) === (isTest(path) || isGenerated(path)),
    );
    expect(wrong).toEqual([]);
  });
});
