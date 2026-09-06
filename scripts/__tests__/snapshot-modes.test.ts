/**
 * #1149: a snapshot or generated file for a mode its fixture excludes.
 *
 * A `// test-cpp-only` fixture is never run as C, so its `.expected.h` is never
 * regenerated and never compared. It looks exactly like every other snapshot
 * and asserts nothing, while preserving whatever codegen produced the day it
 * was written. Several held C++ syntax in a `.h` -- `void f(Config& c);` --
 * which is not C and never was.
 *
 * CLAUDE.md carried the count as 30 and the instruction "exclude them from any
 * corpus-wide analysis", which is an instruction to remember something. 80 were
 * found when it was measured: 66 snapshots and 14 generated files. Deleting
 * them without this guard would only reset the clock, so the property is
 * asserted instead -- and then no analysis has to remember to exclude anything,
 * because there is nothing to exclude.
 *
 * The rule is one line: a file's mode comes from its extension, its fixture's
 * mode comes from its marker, and they may not contradict.
 */

import { readFileSync } from "node:fs";
import { join, sep } from "node:path";

import FileScanner from "../utils/FileScanner";
import FixtureFiles from "../headers/FixtureFiles";

const rootDir = join(__dirname, "..", "..");
const testsDir = join(rootDir, "tests");

const sourceCache = new Map<string, string>();
function readSource(path: string): string {
  const cached = sourceCache.get(path);
  if (cached !== undefined) return cached;
  const text = readFileSync(path, "utf-8");
  sourceCache.set(path, text);
  return text;
}

/** Every file under `tests/` the transpiler wrote or a snapshot of one. */
function transpilerArtifacts(): string[] {
  const found: string[] = [];
  for (const suffix of [".c", ".h", ".cpp", ".hpp"]) {
    for (const full of FileScanner.findFiles(testsDir, suffix)) {
      if (full.includes(`${sep}libs${sep}`)) continue; // vendored third party
      found.push(full);
    }
  }
  return found;
}

describe("snapshots and generated files match their fixture's mode (#1149)", () => {
  const artifacts = transpilerArtifacts();

  it("finds the artifacts at all", () => {
    // Guards the selector. If the walk returns nothing, the assertion below
    // passes over an empty list -- #1297's shape, one level up.
    expect(artifacts.length).toBeGreaterThan(1000);
  });

  it("has no file for a mode its fixture excludes", () => {
    const orphans: string[] = [];
    for (const artifact of artifacts) {
      const source = FixtureFiles.sourceOf(artifact, (candidate) => {
        try {
          readSource(candidate);
          return true;
        } catch {
          return false;
        }
      });
      if (source === null) continue; // hand-written, or vendored
      if (FixtureFiles.isModeOrphan(artifact, readSource(source))) {
        orphans.push(artifact.slice(rootDir.length + 1));
      }
    }

    expect(orphans).toEqual([]);
  });
});
