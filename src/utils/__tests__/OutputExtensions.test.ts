/**
 * Issue #1319: the mode -> extension decision has exactly one owner.
 *
 * Before this, nine sites across `data/`, `logic/`, `output/` and the
 * orchestrator each wrote `cppMode ? ".hpp" : ".h"` for themselves. They agreed
 * only because each had been hand-written the same way -- nothing made them
 * agree, and five defaulted the mode to `false`, so a site that was simply never
 * passed the value emitted `.h` in a C++ run with no diagnostic.
 *
 * Counting where the *fact* lived (the issue's own table said four places) does
 * not catch that. Sharing a detection function would not have caught it either:
 * CLAUDE.md is explicit that single source of truth means the decision, not just
 * the data, and a shared helper each caller feeds its own copy of the mode into
 * is still nine derivations. So the gate is on the derivation itself.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

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
  it("maps the C++ latch to the extensions the run emits", () => {
    expect(OutputExtensions.forCppMode(true)).toEqual({
      source: ".cpp",
      header: ".hpp",
    });
    expect(OutputExtensions.forCppMode(false)).toEqual({
      source: ".c",
      header: ".h",
    });
  });

  it("is the only place a mode is turned into an extension", () => {
    const offenders = tsFilesUnder(SRC_ROOT)
      .filter((file) => MODE_TO_EXTENSION.test(readFileSync(file, "utf-8")))
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
