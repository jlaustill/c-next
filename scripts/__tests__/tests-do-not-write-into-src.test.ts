/**
 * #1640: no test writes a temp tree into `src/`.
 *
 * `HeaderOwnership.test.ts` walks the whole source tree to prove one module
 * derives a consequence from `selfIncludeAdded`, and four tests under
 * `src/transpiler/data/__tests__/` used to create and remove directories
 * inside it in `beforeEach`/`afterEach`. Vitest runs test FILES in parallel,
 * so the walker could list a directory that was gone by the time it stat'd it
 * and fail with ENOENT instead of its own assertion.
 *
 * The walker is robust now, so this is not what stops THAT crash. It stops the
 * coupling coming back: the next scanner over `src/` would meet the same
 * hazard, and the fix -- write to `tmpdir()`, which has no scanner -- is the
 * kind that gets undone by someone reaching for the pattern they find nearby.
 *
 * ## Why it is keyed on the two together
 *
 * `__dirname` alone is how a test finds a FIXTURE to read, which is fine and
 * common. A write call alone says nothing about where. It is a file that does
 * both that puts a mutable directory inside the tree other tests scan.
 *
 * The honest limit: a path assembled some other way -- through a helper, or
 * from `import.meta.url` -- is invisible here. This is name-keyed, like its
 * neighbors, and catches the pattern rather than the capability.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const srcDir = join(rootDir, "src");

/** Calls that CREATE something on disk, as opposed to reading a fixture. */
const WRITES =
  /\b(mkdirSync|writeFileSync|mkdtempSync|cpSync|appendFileSync)\b/;

/** A path assembled from the file's own location inside `src/`. */
const FROM_DIRNAME = /\bjoin\(\s*__dirname\b/;

function testFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...testFiles(full));
    } else if (entry.name.endsWith(".test.ts")) {
      found.push(full);
    }
  }
  return found;
}

describe("tests do not write into src/ (#1640)", () => {
  it("names no test that builds a write path from __dirname", () => {
    const offenders = testFiles(srcDir)
      .filter((path) => {
        const source = readFileSync(path, "utf-8");
        return WRITES.test(source) && FROM_DIRNAME.test(source);
      })
      .map((path) => path.slice(rootDir.length + 1))
      .sort();

    expect(offenders).toEqual([]);
  });

  // The other selector's control, and it was missing. `offenders` is a
  // CONJUNCTION, so a dead `WRITES` empties it -- and the read-only control
  // below gets EASIER, not harder, because `!WRITES.test(source)` then holds
  // for every file. Both tests pass with the write-call names replaced by
  // a string that matches nothing; measured, not reasoned about. Found by review.
  it("finds the write calls at all", () => {
    const writers = testFiles(srcDir).filter((path) =>
      WRITES.test(readFileSync(path, "utf-8")),
    );

    expect(writers.length).toBeGreaterThan(0);
  });

  // The negative control, asserted rather than assumed. `__dirname` is also how
  // a test finds a FIXTURE to read, and that is fine -- so the check above is
  // only meaningful while files of that shape exist for it to let through. If
  // the last one ever goes, the rule above stops distinguishing anything and
  // this says so, instead of passing vacuously.
  it("lets a test that only READS from __dirname through", () => {
    const readers = testFiles(srcDir).filter((path) => {
      const source = readFileSync(path, "utf-8");
      return FROM_DIRNAME.test(source) && !WRITES.test(source);
    });

    expect(readers.length).toBeGreaterThan(0);
  });
});
