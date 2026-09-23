/**
 * #1656: "is this type name a struct" is derived in exactly one place.
 *
 * It was derived in three, and they had not diverged in RESULT -- which is why
 * nothing caught them for as long as they existed:
 *
 * - `CodeGenState.isKnownStruct`
 * - `SymbolLookupHelper.isKnownStruct`, reached through `IOrchestrator`
 * - `ExpressionTypeResolver.isStructType` in 2-Plan, which alone had ten sites
 *   through `IOrchestrator.isStructType`
 *
 * All three ran the same three checks in the same order; the 2-Plan copy
 * differed from the `state/` copy only in `CodeGenState.` versus `this.`. What
 * they had diverged in was FAILURE MODE: two called `getStructFields`
 * unconditionally and one optional-chained the METHOD, so removing it would
 * have thrown at two sites and silently answered `false` at the third.
 *
 * `CLAUDE.md` is explicit that sharing the DATA is not enough -- the decision
 * is the unit. Three copies reading the same two sets is exactly the shape the
 * rule names, and nothing in the repository could report it: they type-check,
 * knip sees three used methods, and depcruise keys on paths rather than on what
 * a function computes.
 *
 * ## Why the detector is a window and not a name
 *
 * Keying on `.getStructFields(` does not work: `InitializationAnalyzer` has its
 * own private method of that name returning a different type, with six call
 * sites, none of which is this decision. Keying on a FILE containing all three
 * tokens does not work either -- `CodeGenState` legitimately mentions all three
 * across unrelated members.
 *
 * What identifies the decision is the three checks appearing TOGETHER: the
 * per-file struct set, the per-file bitmap set, and the run-wide table
 * fallback, within a few lines of each other. That is the shape, and a fourth
 * copy would have to avoid writing it to escape this guard -- at which point it
 * is not a copy of this decision.
 *
 * Measured on this tree: 619 files scanned, one site.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const srcDir = join(rootDir, "src");

/** How close the three checks must sit to count as one derivation. */
const WINDOW = 8;

const PER_FILE_STRUCTS = /knownStructs/;
const PER_FILE_BITMAPS = /knownBitmaps/;
const RUN_WIDE_FALLBACK = /getStructFields/;

/** The one module entitled to derive it. */
const THE_IMPLEMENTATION = "src/utils/DeclaredTypeFacts.ts";

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Generated grammar is regenerated wholesale and derives nothing.
      if (entry.name !== "__tests__" && entry.name !== "grammar") {
        found.push(...sourceFiles(full));
      }
    } else if (entry.name.endsWith(".ts")) {
      found.push(full);
    }
  }
  return found;
}

/** True when the three checks appear within `WINDOW` lines of each other. */
function derivesTheDecision(source: string): boolean {
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const window = lines.slice(i, i + WINDOW).join("\n");
    if (
      PER_FILE_STRUCTS.test(window) &&
      PER_FILE_BITMAPS.test(window) &&
      RUN_WIDE_FALLBACK.test(window)
    ) {
      return true;
    }
  }
  return false;
}

function derivingModules(): string[] {
  return sourceFiles(srcDir)
    .filter((path) => derivesTheDecision(readFileSync(path, "utf-8")))
    .map((path) => path.slice(rootDir.length + 1))
    .sort();
}

describe("the struct decision is derived once (#1656)", () => {
  it("names exactly one module that derives it", () => {
    expect(derivingModules()).toEqual([THE_IMPLEMENTATION]);
  });

  it("scans the source tree at all", () => {
    // Population control. An empty scan satisfies nothing above and reads
    // exactly like a unified codebase.
    expect(sourceFiles(srcDir).length).toBeGreaterThan(100);
  });

  it("detects the three checks written together", () => {
    // Per-arm control: the assertion above passes when the detector matches
    // ONE site, so a detector that had stopped matching would still name the
    // implementation only if it kept matching IT. This pins the shape itself.
    const copy = [
      "static isStructType(name: string): boolean {",
      "  if (CodeGenState.symbols?.knownStructs.has(name)) return true;",
      "  if (CodeGenState.symbols?.knownBitmaps.has(name)) return true;",
      "  if (CodeGenState.symbolTable.getStructFields(name)) return true;",
      "  return false;",
      "}",
    ].join("\n");

    expect(derivesTheDecision(copy)).toBe(true);
  });

  it("does not fire on two of the three checks", () => {
    // Over-enforcement control. `CodeGenState` mentions all three tokens across
    // unrelated members, and `InitializationAnalyzer` has its own private
    // `getStructFields` with six call sites. Neither is this decision, and a
    // detector that flagged them would be unsatisfiable.
    const structsAndBitmaps = [
      "if (sets.knownStructs.has(name)) return true;",
      "if (sets.knownBitmaps.has(name)) return true;",
    ].join("\n");
    const tableOnly = "return this.getStructFields(name) !== undefined;";

    expect(derivesTheDecision(structsAndBitmaps)).toBe(false);
    expect(derivesTheDecision(tableOnly)).toBe(false);
  });

  it("does not fire when the checks are far apart", () => {
    // The window is what makes this a derivation rather than a file-level
    // token census. Three unrelated mentions in one module must stay silent.
    const spread = [
      "  static isKnownBitmap(n: string) { return this.knownBitmaps.has(n); }",
      ...Array<string>(WINDOW + 2).fill("  // ..."),
      "  static structFields(n: string) { return this.getStructFields(n); }",
      ...Array<string>(WINDOW + 2).fill("  // ..."),
      "  static knownStructsView() { return this.knownStructs; }",
    ].join("\n");

    expect(derivesTheDecision(spread)).toBe(false);
  });
});
