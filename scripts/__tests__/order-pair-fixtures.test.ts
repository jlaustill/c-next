/**
 * #1430 review: an include-order fixture pair asserts ONE diagnostic set, and
 * nothing enforced that.
 *
 * The pair shape -- two `*-first.test.cnx` entries listing the same helpers in
 * opposite `#include` order -- exists to catch an analyzer whose answer depends
 * on which file was processed before this one. Each half is a `test-error`
 * fixture with its own `.expected.error`, and the claim "same sources, opposite
 * order, identical diagnostics" was held only by a comment and by the two files
 * happening to be byte-identical.
 *
 * That dissolves silently. Reintroduce the #1430 regression and run `--update`:
 * `source-first.expected.error` is rewritten down to the one diagnostic the stale
 * state did not suppress, the run reports `Passed: 2, Updated: 2`, and both
 * guards stay green -- #1316's `--update` guard fires only when a fixture stops
 * erroring altogether, and the under-enforcement control that keeps the fixture
 * meaningful is exactly what keeps it erroring; `diagnostics:manifest:check`
 * still sees E0427 asserted through that same control line, so `code-removed`
 * cannot fire. The order dependence is then recorded as expected output.
 *
 * So the property is asserted here rather than remembered, the way
 * `layer-rules.test.ts` requires `reachable: true` instead of trusting authors
 * to add it. Every directory under `tests/bugs/` holding `*-first.expected.error`
 * files must hold at least two, and they must be byte-identical.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const BUGS_DIR = join(__dirname, "..", "..", "tests", "bugs");
const PAIR_SUFFIX = "-first.expected.error";

function collectPairFiles(dir: string, into: Map<string, string[]>): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectPairFiles(full, into);
    } else if (entry.endsWith(PAIR_SUFFIX)) {
      const group = into.get(dir) ?? [];
      group.push(full);
      into.set(dir, group);
    }
  }
}

function orderPairsByDirectory(): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  collectPairFiles(BUGS_DIR, groups);
  for (const files of groups.values()) {
    files.sort();
  }
  return groups;
}

describe("include-order fixture pairs (#1430)", () => {
  const groups = orderPairsByDirectory();

  it("finds the pairs at all", () => {
    // An empty discovery would make every assertion below vacuously green.
    const dirs = [...groups.keys()].map((d) => d.slice(BUGS_DIR.length + 1));
    expect(dirs).toEqual(
      expect.arrayContaining([
        "issue-1312-undefined-type-position",
        "issue-1430-e0427-order-dependence",
      ]),
    );
  });

  it("never has a lone half -- the name promises a pair", () => {
    for (const [dir, files] of groups) {
      expect(
        files.length,
        `${dir} holds ${files.length} *${PAIR_SUFFIX}`,
      ).toBeGreaterThanOrEqual(2);
    }
  });

  it("every pair asserts one diagnostic set, byte for byte", () => {
    for (const [, files] of groups) {
      const reference = readFileSync(files[0], "utf8");
      for (const other of files.slice(1)) {
        expect(
          readFileSync(other, "utf8"),
          `${other} differs from ${files[0]}`,
        ).toBe(reference);
      }
    }
  });
});
