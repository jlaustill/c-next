/**
 * #1489: every source under scripts/ is in the program `npm run
 * typecheck:scripts` -- the command CI runs -- checks.
 *
 * The typecheck cannot report a file it does not include, so a file outside
 * the program is invisible to it: that is how test-cli.js went unchecked while
 * the three .mjs beside it were read under `allowJs` but never reported (no
 * `checkJs`), until all four held 99 errors between them.
 *
 * The answer is DERIVED, not listed. An allowlist of extensions would restate
 * `tsconfig.scripts.json`'s `include` and agree with it only by coincidence:
 * it would pass a `.mts`, `.cts` or `.tsx` (which `scripts/**\/*.ts` does not
 * match), and stay green if the `include` were narrowed (#1850 review). This
 * asks `tsc` for the program itself and compares it with what git tracks.
 */

import { execFileSync } from "node:child_process";
import { join, relative, sep } from "node:path";

const repoRoot = join(__dirname, "..", "..");

// Tracked under scripts/ but not source, so no program needs to include it.
const NOT_SOURCE = /\.(sh|txt)$/;

function trackedScripts(): string[] {
  return execFileSync("git", ["ls-files", "-z", "scripts"], {
    cwd: repoRoot,
    encoding: "utf8",
  })
    .split("\0")
    .filter((path) => path !== "");
}

/** The repo-relative scripts/ files in the program `typecheck:scripts` builds. */
function typecheckedScripts(): Set<string> {
  const tsc = join(repoRoot, "node_modules", "typescript", "bin", "tsc");
  const listed = execFileSync(
    process.execPath,
    [tsc, "-p", "tsconfig.scripts.json", "--listFilesOnly"],
    { cwd: repoRoot, encoding: "utf8" },
  );
  return new Set(
    listed
      .split("\n")
      .filter((path) => path !== "")
      .map((path) => relative(repoRoot, path).split(sep).join("/"))
      .filter((path) => path.startsWith("scripts/")),
  );
}

describe("every source under scripts/ is typechecked (#1489)", () => {
  const tracked = trackedScripts();
  const typechecked = typecheckedScripts();

  it("finds the scripts and the program at all", () => {
    // Guards both selectors: an empty listing on either side makes the
    // assertion below vacuous rather than failing (#1297).
    expect(tracked.length).toBeGreaterThan(100);
    expect(typechecked.size).toBeGreaterThan(100);
  });

  it("exempts exactly the non-source kinds it names", () => {
    // One probe per arm, so dropping an arm reddens this rather than turning
    // that kind into an unexplained failure below; and the source kinds the
    // `include` misses must not be exempted by accident.
    for (const probe of ["gate.sh", "list.txt"]) {
      expect(NOT_SOURCE.test(probe)).toBe(true);
    }
    for (const probe of ["a.ts", "a.js", "a.mjs", "a.mts", "a.cts", "a.tsx"]) {
      expect(NOT_SOURCE.test(probe)).toBe(false);
    }
  });

  it("has no tracked source the typecheck cannot see", () => {
    expect(
      tracked.filter(
        (path) => !NOT_SOURCE.test(path) && !typechecked.has(path),
      ),
    ).toEqual([]);
  });
});
