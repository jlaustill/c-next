/**
 * Issue #1416: `cspell .` does not descend into dot-directories.
 *
 * `.claude/` and `.github/` are authored, committed, and were silently outside
 * `npm run cspell:check` — the same shape as #1309, where `docs/decisions/**`
 * sat in `ignorePaths` and hid 281 issues across all 77 ADRs. #1309 was found by
 * a person noticing; this exists so the next one is not.
 *
 * The set of directories is DERIVED from what git tracks, never listed here. A
 * hand-kept list goes stale in the one direction that matters: a new authored
 * dot-directory is exactly the thing nobody remembers to add, and its absence
 * from a list looks identical to a deliberate exclusion.
 *
 * An exclusion must therefore be written down where it can be reviewed --
 * `ignorePaths` in `.cspell.json` -- rather than achieved by omission. `.idea/`
 * is excluded that way: it is JetBrains-generated XML carrying JetBrains' own
 * misspellings ("Overriden", "Doesnt"), which this project did not write and
 * cannot fix.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The globs `npm run cspell:check` actually passes to cspell. */
function scopeGlobs(): string[] {
  const pkg: unknown = JSON.parse(
    readFileSync(join(repoRoot, "package.json"), "utf8"),
  );
  const command = (pkg as { scripts?: Record<string, string> }).scripts?.[
    "cspell:check"
  ];
  if (command === undefined) {
    throw new Error('package.json has no "cspell:check" script');
  }
  return Array.from(command.matchAll(/"([^"]+)"/g)).map((match) => match[1]);
}

function ignorePaths(): string[] {
  const config: unknown = JSON.parse(
    readFileSync(join(repoRoot, ".cspell.json"), "utf8"),
  );
  const paths = (config as { ignorePaths?: unknown }).ignorePaths;
  if (!Array.isArray(paths)) {
    throw new Error('.cspell.json has no "ignorePaths" array');
  }
  return paths as string[];
}

/** Top-level dot-directories git tracks — the ones a bare `cspell .` misses. */
function trackedDotDirectories(): string[] {
  const tracked = execFileSync("git", ["ls-files", "-z"], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  }).split("\0");

  const directories = tracked
    .filter((path) => path.startsWith(".") && path.includes("/"))
    .map((path) => path.slice(0, path.indexOf("/")));

  return Array.from(new Set(directories)).sort();
}

describe("cspell:check scope (#1416)", () => {
  const directories = trackedDotDirectories();

  // Guards the selector, so the assertion below cannot pass over an empty list.
  it("finds tracked dot-directories to check at all", () => {
    expect(directories.length).toBeGreaterThanOrEqual(3);
  });

  it("covers every tracked dot-directory, or ignores it on purpose", () => {
    const globs = scopeGlobs();
    const ignored = ignorePaths();

    const unreachable = directories.filter((directory) => {
      const inScope = globs.some((glob) => glob.startsWith(`${directory}/`));
      const excluded = ignored.some((path) => path.startsWith(`${directory}/`));
      return !inScope && !excluded;
    });

    expect(unreachable).toEqual([]);
  });

  // The negative control. Blindness must not be reachable by omission: a
  // directory absent from BOTH the globs and ignorePaths has to fail, which is
  // precisely the state `.claude/` was in before this.
  it("fails a directory that is neither in scope nor ignored", () => {
    const globs = [".github/**"];
    const ignored = [".idea/**"];
    const unreachable = [".claude", ".github", ".idea"].filter((directory) => {
      const inScope = globs.some((glob) => glob.startsWith(`${directory}/`));
      const excluded = ignored.some((path) => path.startsWith(`${directory}/`));
      return !inScope && !excluded;
    });

    expect(unreachable).toEqual([".claude"]);
  });
});
