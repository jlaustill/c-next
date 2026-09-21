/**
 * Issue #1450 box 4: Render decides nothing.
 *
 * "The included header owns this declaration, so this file does not emit it"
 * was derived at five sites from one flag, in four spellings -- `? "" :` in two
 * declaration generators, `? [] :` inside `StructGenerator`, an `&&` against a
 * per-name predicate for callback typedefs, and a `&& !` in `EmissionPlan` for
 * the ADR-040 `ISR` typedef. They agreed, which is exactly the failure mode:
 * nothing held them together except that one rule had been written out five
 * times and nobody had yet changed it.
 *
 * `docs/architecture/README.md` principle 5 -- "an invariant without a gate
 * does not count" -- is why the second test exists. Unifying the sites is
 * undone by the next person who writes the ternary inline, and the suite would
 * stay green, because agreeing derivations produce identical output. The
 * divergence has to be caught at its SOURCE, the moment a sixth site appears,
 * not by a fixture that can only notice once two of them disagree.
 *
 * Same shape as `assignment-operator-parity.test.ts` (#1588) and
 * `marker-spellings.test.ts`: the forbidden form is derived by reading the
 * tree, never listed here, so the guard cannot go stale against a file it does
 * not know about.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import HeaderOwnership from "../HeaderOwnership";

const repoRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
);

/**
 * The one module allowed to turn the fact into the decision.
 *
 * A path, not a basename: the point is that exactly this file owns the rule.
 */
const OWNER = join("src", "TRANSPILE", "2-Plan", "HeaderOwnership.ts");

/**
 * `selfIncludeAdded` used as a CONDITION rather than carried as a value.
 *
 * Negated, or feeding a ternary or a boolean operator. Plumbing is deliberately
 * not matched -- `selfIncludeAdded: CodeGenState.selfIncludeAdded,` passes the
 * fact along without deciding anything from it, and so does
 * `HeaderOwnership.ownsDeclarations(CodeGenState.selfIncludeAdded)`, which is
 * the whole point of the exercise.
 */
const DERIVES =
  /(?:!\s*[\w.]*\bselfIncludeAdded)|(?:\bselfIncludeAdded\s*[?&|])/;

/**
 * Every `.ts` under `dir`, production only.
 *
 * #1640: `withFileTypes` asks `readdir` for the kind as part of the listing,
 * so there is no second syscall against a path that may have gone between the
 * two -- which is how this walker used to fail with ENOENT on a temp tree
 * another test file was creating and removing in parallel.
 *
 * `__tests__` is skipped because the claim is about production code: a test
 * that MENTIONS the flag is not a second module deriving from it, and scanning
 * test trees is what put the walker in the path of another test's fixtures in
 * the first place.
 */
function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "__tests__") {
      continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...sourceFiles(full));
    } else if (entry.name.endsWith(".ts")) {
      found.push(full);
    }
  }
  return found;
}

describe("HeaderOwnership", () => {
  it.each<[string, boolean, boolean]>([
    ["the file includes its own header", true, true],
    ["the file has no header to include", false, false],
  ])("owns declarations when %s", (_label, selfIncludeAdded, expected) => {
    expect(HeaderOwnership.ownsDeclarations(selfIncludeAdded)).toBe(expected);
  });

  it("is the only module that derives the consequence from the flag", () => {
    const offenders = sourceFiles(join(repoRoot, "src"))
      .map((file) => relative(repoRoot, file))
      .filter((file) => file !== OWNER)
      .filter((file) =>
        DERIVES.test(readFileSync(join(repoRoot, file), "utf8")),
      );

    expect(offenders).toEqual([]);
  });
});
