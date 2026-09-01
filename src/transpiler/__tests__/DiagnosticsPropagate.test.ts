/**
 * Issue #1319: a deliberate diagnostic is never swallowed by a tolerance catch.
 *
 * Header handling is deliberately forgiving -- a third-party header that will
 * not parse must not fail the build -- so `Transpiler` catches broadly around
 * header parsing. E0507 travels the same call graph, and a broad catch does not
 * distinguish "this header is unparseable" from "this run was told to emit C and
 * met C++". Swallowing the second produced `Warning: ... Compiled 1 files` and
 * exit 0: a diagnostic against silent failure, failing silently.
 *
 * The fix is one line per catch, which is exactly why it needs a gate. It was
 * applied to `_collectAllHeaderSymbols` and missed on `_parseRecoveredSlices`,
 * its sibling on the same call graph -- one decision made in one place and not
 * the other, which CLAUDE.md calls the worst anti-pattern in this project. A
 * reviewer found it; nothing in the suite could have.
 *
 * Reachability differs between the two (recovery runs on the preprocessed
 * translation unit where stage 2 saw raw content), and no fixture reaches the
 * recovery path today. That is the argument for a structural gate rather than a
 * behavioral one: this asserts the decision is made in both places, which is
 * checkable, instead of asserting an outcome that cannot currently be produced.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

const SOURCE = readFileSync(join(__dirname, "..", "Transpiler.ts"), "utf-8");

/** Calls that can now raise a C-Next diagnostic rather than a parse failure. */
const DIAGNOSTIC_RAISING = ["parseCHeader(", "doCollectHeaderSymbols("];

interface ICatchSite {
  readonly tryBody: string;
  readonly catchBody: string;
  readonly line: number;
}

/**
 * Every `try { ... } catch (...) { ... }` in the file, with both bodies.
 *
 * Brace-matched rather than regex-matched: these bodies nest, and a regex that
 * stops at the first `}` would read a truncated body and could report a catch
 * as guarded because the word appeared in an inner block.
 */
const catchSites = (source: string): ICatchSite[] => {
  const sites: ICatchSite[] = [];
  const matchFrom = (open: number): number => {
    let depth = 0;
    for (let i = open; i < source.length; i += 1) {
      if (source[i] === "{") depth += 1;
      else if (source[i] === "}") {
        depth -= 1;
        if (depth === 0) return i;
      }
    }
    return -1;
  };

  const pattern = /\btry\s*\{/g;
  let match = pattern.exec(source);
  while (match !== null) {
    const tryOpen = match.index + match[0].length - 1;
    const tryClose = matchFrom(tryOpen);
    const after = source.slice(tryClose + 1, tryClose + 40);
    const catchOpen = source.indexOf("{", tryClose + 1);
    if (tryClose !== -1 && /^\s*catch\b/.test(after) && catchOpen !== -1) {
      const catchClose = matchFrom(catchOpen);
      sites.push({
        tryBody: source.slice(tryOpen, tryClose + 1),
        catchBody: source.slice(catchOpen, catchClose + 1),
        line: source.slice(0, match.index).split("\n").length,
      });
    }
    match = pattern.exec(source);
  }
  return sites;
};

describe("diagnostics propagate past tolerance catches (#1319)", () => {
  const sites = catchSites(SOURCE);
  const guarding = sites.filter((s) =>
    DIAGNOSTIC_RAISING.some((call) => s.tryBody.includes(call)),
  );

  it("finds the catches that wrap a diagnostic-raising call", () => {
    // Negative control. If the scan or the call names drift, `guarding` goes
    // empty and the assertion below passes over nothing -- the same silent
    // shape (#1143) this file exists to prevent one level down.
    expect(guarding.length).toBeGreaterThanOrEqual(2);
  });

  it("every one of them re-throws a deliberate diagnostic", () => {
    const unguarded = guarding
      .filter((s) => !s.catchBody.includes("isDiagnostic"))
      .map((s) => `Transpiler.ts:${s.line}`);

    expect(unguarded).toEqual([]);
  });

  it("does not flag catches that wrap no such call", () => {
    // The other direction: the gate must not demand the guard everywhere, or it
    // would push authors to bolt `isDiagnostic` onto unrelated catches to pass.
    const unrelated = sites.filter(
      (s) => !DIAGNOSTIC_RAISING.some((call) => s.tryBody.includes(call)),
    );

    expect(unrelated.length).toBeGreaterThan(0);
    expect(unrelated.every((s) => !s.catchBody.includes("isDiagnostic"))).toBe(
      true,
    );
  });
});
