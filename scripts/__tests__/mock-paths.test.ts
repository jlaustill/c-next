/**
 * Every relative `vi.mock()` specifier must resolve to a file that exists.
 *
 * #1445 box 3: a `vi.mock("<path>")` naming a module that is not there does
 * NOT error. Vitest registers the factory against a specifier nothing imports,
 * the real module loads, and the test runs against it.
 *
 * That fails in two very different ways, and only one of them is visible:
 *
 * - the test calls `vi.mocked(X.method)` -- `TypeError: ... is not a function`,
 *   loud and immediate. `UnaryExprGenerator.test.ts` did this.
 * - the test only relies on the mock's behavior -- the real module answers
 *   instead and the suite stays **green**. `ArrayHandlers.test.ts` did this,
 *   and 349 test files passed while its mock was inert.
 *
 * Both were caused by the same commit, which moved `TypeResolver` to
 * `2-Plan/ExpressionTypeResolver`. ts-morph rewrites import DECLARATIONS; a
 * `vi.mock()` path is a string literal argument and is not one, so it is left
 * behind by every tool that makes moving modules safe. That is the whole
 * reason this guard exists rather than a convention: the repo's stated way to
 * move a module cannot fix these, and the silent case gives nobody a reason to
 * look.
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, readdirSync, statSync } from "node:fs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** `vi.mock("...")` / `vi.doMock("...")` with a single-quoted or double-quoted path. */
const MOCK_CALL = /vi\.(?:do)?[Mm]ock\(\s*["']([^"']+)["']/g;

const CANDIDATE_SUFFIXES = ["", ".ts", ".tsx", ".js", "/index.ts"];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return entry === "node_modules" ? [] : walk(full);
    }
    return full.endsWith(".ts") ? [full] : [];
  });
}

describe("vi.mock specifiers", () => {
  const sources = [join(repoRoot, "src"), join(repoRoot, "scripts")].flatMap(
    (root) => (existsSync(root) ? walk(root) : []),
  );

  const specifiers = sources.flatMap((file) => {
    // Comments are stripped first. Without it this guard matched the
    // `vi.mock("...")` in its OWN header and reported itself -- and any file
    // that documents the pattern would have done the same. Crude but
    // sufficient: the only thing it can lose is a `vi.mock` written inside a
    // string literal, which is not a call.
    const text = readFileSync(file, "utf-8")
      .replaceAll(/\/\*[\s\S]*?\*\//g, "")
      .replaceAll(/\/\/[^\n]*/g, "");
    return [...text.matchAll(MOCK_CALL)]
      .map((match) => match[1])
      .filter((spec) => spec.startsWith("."))
      .map((spec) => ({ file, spec }));
  });

  it("finds the population at all", () => {
    // Guards the selector. If the regex stops matching, every assertion below
    // passes over an empty list and proves nothing -- the inert-guard shape
    // (#1143) this file exists to prevent, reintroduced in the file itself.
    expect(specifiers.length).toBeGreaterThan(0);
  });

  it("all resolve to a file that exists", () => {
    const unresolvable = specifiers
      .filter(
        ({ file, spec }) =>
          !CANDIDATE_SUFFIXES.some((suffix) =>
            existsSync(resolve(dirname(file), spec) + suffix),
          ),
      )
      .map(
        ({ file, spec }) => `${file.replace(repoRoot + "/", "")} -> ${spec}`,
      );

    expect(unresolvable).toEqual([]);
  });
});
