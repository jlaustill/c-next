/**
 * Issue #1319: the mode -> extension decision has exactly one owner.
 *
 * Before this, nine sites across `data/`, `logic/`, `output/` and the
 * orchestrator each wrote `cppMode ? ".hpp" : ".h"` for themselves. They agreed
 * only because each had been hand-written the same way -- nothing made them
 * agree, and six defaulted the mode to `false`, so a site that was simply never
 * passed the value emitted `.h` in a C++ run with no diagnostic. Five are gone;
 * the sixth is pinned below rather than left unwatched.
 *
 * Counting where the *fact* lived (the issue's own table said four places) does
 * not catch that. Sharing a detection function would not have caught it either:
 * CLAUDE.md is explicit that single source of truth means the decision, not just
 * the data, and a shared helper each caller feeds its own copy of the mode into
 * is still nine derivations. So the gate is on the derivation itself.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";

import { describe, it, expect } from "vitest";

import OutputExtensions from "../OutputExtensions";

const SRC_ROOT = join(__dirname, "..", "..");

/** The file that is allowed to map a mode to an extension. */
const OWNER = join("utils", "OutputExtensions.ts");

/**
 * A ternary selecting a C++ file extension against its C counterpart, in either
 * order -- `x ? ".hpp" : ".h"` and `x ? ".h" : ".hpp"` are the same decision.
 */
const MODE_TO_EXTENSION =
  /\?\s*"\.(?:hpp|cpp)"\s*:\s*"\.(?:h|c)"|\?\s*"\.(?:h|c)"\s*:\s*"\.(?:hpp|cpp)"/;

/**
 * Code lines only. A comment that quotes the shape -- including the one in
 * `OutputExtensions.ts` naming the residual default -- is prose about a
 * derivation, not one. Scanning raw file text counted it, and the file that
 * documents the rule became its own first offender.
 */
const codeOf = (source: string): string =>
  source
    .split("\n")
    .filter((line) => !/^\s*(?:\/\/|\/\*|\*)/.test(line))
    .join("\n");

const tsFilesUnder = (dir: string): string[] => {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      found.push(...tsFilesUnder(full));
      continue;
    }
    if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) found.push(full);
  }
  return found;
};

describe("OutputExtensions (#1319)", () => {
  it("maps the declared mode to the extensions the run emits", () => {
    expect(OutputExtensions.forCppMode(true)).toEqual({
      source: ".cpp",
      header: ".hpp",
    });
    expect(OutputExtensions.forCppMode(false)).toEqual({
      source: ".c",
      header: ".h",
    });
  });

  it("has no ternary mode-to-extension derivation under src/", () => {
    // Named for what it checks, not for the guarantee one might want from it.
    // The regex catches a copy-paste of a deleted ternary -- the realistic
    // reintroduction -- and misses `if (cppMode) { ext = ".hpp"; }`, string
    // concatenation and template literals. `scripts/` is out of scope on
    // purpose: `test-utils.ts` derives both extensions the same way, and the
    // harness drives the CLI precisely so it does not import transpiler
    // internals, so that copy is an independent oracle rather than a tenth
    // derivation.
    const offenders = tsFilesUnder(SRC_ROOT)
      .filter((file) =>
        MODE_TO_EXTENSION.test(codeOf(readFileSync(file, "utf-8"))),
      )
      .filter((file) => !file.endsWith(OWNER))
      .map((file) => file.slice(SRC_ROOT.length + 1));

    expect(offenders).toEqual([]);
  });

  it("detects the shape it hunts for", () => {
    // Negative control, and the reason it is phrased against literals rather
    // than against the owner's source: a source-scanning gate has two failure
    // modes and only one is loud. "Are there offenders?" fails visibly when the
    // codebase regresses. "Does the pattern match anything at all?" fails
    // silently forever, because an empty offender list looks the same whether
    // the codebase is clean or the regex is broken. So assert on known
    // positives -- the exact forms deleted by #1319 -- and on a known negative.
    expect(MODE_TO_EXTENSION.test('cppMode ? ".hpp" : ".h"')).toBe(true);
    expect(MODE_TO_EXTENSION.test('cppMode ? ".cpp" : ".c"')).toBe(true);
    expect(MODE_TO_EXTENSION.test('this.cppMode ? ".hpp" : ".h"')).toBe(true);
    // Selecting between prepared values is the owner's shape, not a derivation.
    expect(MODE_TO_EXTENSION.test("cppMode ? CPP : C")).toBe(false);
  });

  it("pins the one silent mode default that remains (#1428)", () => {
    // The ternary scan above cannot see a DEFAULT, which is the other way a
    // site answers "C" without being told. Six existed; five were removed with
    // the derivations. This fails if a seventh appears -- and also once #1428
    // lands, which is the prompt to delete this exemption rather than a defect.
    const defaults = tsFilesUnder(SRC_ROOT)
      .filter((file) =>
        codeOf(readFileSync(file, "utf-8"))
          .split("\n")
          // `this.cppMode = false` in reset() is a reset, not a default.
          .filter((line) => !line.includes("this.cppMode ="))
          .some((line) => /cppMode\s*(?:\?\?|=)\s*false/.test(line)),
      )
      .map((file) => file.slice(SRC_ROOT.length + 1));

    expect(defaults).toEqual([
      ["transpiler", "output", "codegen", "CodeGenerator.ts"].join(sep),
    ]);
  });

  it("is reachable -- the owner is actually used", () => {
    // A gate on "nobody derives this" goes green if nobody needs it either.
    const callers = tsFilesUnder(SRC_ROOT)
      .filter((file) => !file.endsWith(OWNER))
      .filter((file) =>
        /OutputExtensions\.forCppMode\(/.test(readFileSync(file, "utf-8")),
      );

    expect(callers.length).toBeGreaterThan(0);
  });
});
