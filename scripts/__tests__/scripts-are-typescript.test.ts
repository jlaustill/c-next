/**
 * #1489: every source under scripts/ is TypeScript, so `npm run
 * typecheck:scripts` -- the command CI runs -- checks all of it.
 *
 * `tsconfig.scripts.json` includes `scripts/**\/*.ts` and has no `allowJs`. A
 * JavaScript file here would therefore be outside the program, and nothing
 * would say so: that is how test-cli.js went unchecked while the three .mjs
 * beside it were read under `allowJs` but never reported (no `checkJs`), until
 * all four held 99 errors between them. The typecheck cannot see a file it
 * does not include, so the guard is here.
 */

import { execFileSync } from "node:child_process";
import { join } from "node:path";

const repoRoot = join(__dirname, "..", "..");

const JAVASCRIPT = /\.(js|mjs|cjs|jsx)$/;

function trackedScripts(): string[] {
  return execFileSync("git", ["ls-files", "-z", "scripts"], {
    cwd: repoRoot,
    encoding: "utf8",
  })
    .split("\0")
    .filter((path) => path !== "");
}

describe("scripts/ holds no JavaScript (#1489)", () => {
  const tracked = trackedScripts();

  it("finds the scripts at all", () => {
    // Guards the selector: an empty listing passes the assertion below over
    // nothing (#1297).
    expect(
      tracked.filter((path) => path.endsWith(".ts")).length,
    ).toBeGreaterThan(100);
  });

  it("matches every JavaScript extension it names", () => {
    // One probe per arm of the alternation, so dropping an arm reddens this
    // rather than letting that extension walk past the assertion below.
    for (const probe of ["a.js", "a.mjs", "a.cjs", "a.jsx"]) {
      expect(JAVASCRIPT.test(probe)).toBe(true);
    }
    expect(JAVASCRIPT.test("a.ts")).toBe(false);
  });

  it("has no tracked JavaScript file", () => {
    expect(tracked.filter((path) => JAVASCRIPT.test(path))).toEqual([]);
  });
});
