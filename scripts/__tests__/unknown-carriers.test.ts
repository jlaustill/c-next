/**
 * #1652: an `unknown`-typed parameter or array field is how a production module
 * holds a parse node while naming none.
 *
 * `parse-tree-confined-to-parser` counts modules that NAME a parse type. Six
 * production sites typed theirs `unknown` instead, and `ICodeGenApi`'s own
 * comment was candid about why:
 *
 * > `ctx` is `unknown` on purpose: the argument is a parse node, and naming its
 * > type here would put this file in the population
 * > `parse-tree-confined-to-parser` gates.
 *
 * So the gate read clean while the coupling was intact, and the render layer
 * could reach zero with parse nodes still flowing through it.
 *
 * ## The honest limit
 *
 * This cannot tell whether a given `unknown` holds a parse node — that is the
 * whole reason the spelling works as a hiding place, and a checker that could
 * decide it would not need to exist. What it does instead is refuse a NEW one:
 * the shape is rare, every current occurrence is accounted for below, and an
 * addition has to be argued here rather than slipped in. Same trade as the
 * roster in `render-decides-nothing.test.ts`.
 *
 * It also cannot see a node laundered some other way — through `any`, a
 * structural duck type, or a generic parameter. Those are not claimed.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const srcRoot = join(repoRoot, "src");

/** `x: unknown` in a parameter position, and `: unknown[]` anywhere. */
/**
 * The two shapes a parse node hides in -- NOT every `unknown` in the repo.
 *
 * `unknown` is used legitimately in sixteen production places: `catch (err:
 * unknown)`, ANTLR's `recognizer` in an error listener, JSON-RPC payloads, the
 * cache codec. None is a node, and matching them would turn this roster into a
 * list of unrelated exemptions nobody reads.
 *
 * So: an ARRAY of them (`: unknown[]`, which is how a list of expressions
 * travels), or a singular one under a name this codebase uses for parse nodes.
 * NAME-KEYED, like the rosters beside it, and with the same weakness -- calling
 * the parameter `thing` evades it. Acceptable because that evasion has to be
 * deliberate, where `ctx: unknown` was the established idiom.
 */
const NODE_NAMES =
  "ctx|node|tree|expr|expression|stmt|statement|operand|target|subscript";
const UNKNOWN_CARRIER = new RegExp(
  ":\\s*unknown\\[\\]|\\b(?:" + NODE_NAMES + ")\\d*\\s*:\\s*unknown\\b",
  "i",
);

/**
 * Every production site allowed to spell it, and why each is not a parse node.
 *
 * A row is `file:member`. Adding one is the point at which someone has to say
 * what the `unknown` holds.
 */
// #1445 review removed a second row -- `SubscriptDepthValidator.expression`,
// the structural shape over raw postfix nodes. Both of its callers pass
// PLANNED ops now, so the shape is gone rather than exempted. The
// orphaned-row assertion below is what reported it: the row outlived its site
// by one commit and said so, which is the direction a roster usually rots in
// silence.
const ACCOUNTED: Readonly<Record<string, string>> = {
  "src/transpiler/types/symbols/IScopeSymbol.ts:variables":
    "symbols, not nodes — the element type is open because `IVariableSymbol` would close a cycle through `TSymbol`",
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return entry === "__tests__" || entry === "grammar" ? [] : walk(full);
    }
    return full.endsWith(".ts") && !full.endsWith(".test.ts") ? [full] : [];
  });
}

function occurrences(): string[] {
  const found: string[] = [];
  for (const file of walk(srcRoot)) {
    const rel = relative(repoRoot, file);
    const text = readFileSync(file, "utf-8")
      .replaceAll(/\/\*[\s\S]*?\*\//g, "")
      .replaceAll(/\/\/[^\n]*/g, "");
    for (const line of text.split("\n")) {
      if (!UNKNOWN_CARRIER.test(line)) continue;
      const member = /(\w+)\s*[(:]/.exec(line.trim())?.[1] ?? "?";
      found.push(`${rel}:${member}`);
    }
  }
  return [...new Set(found)].sort();
}

describe("unknown-typed carriers (#1652)", () => {
  it("finds the shape at all", () => {
    // The selector guard. Every assertion here is about a SET, and a regex that
    // stopped matching would report an empty one — which reads exactly like a
    // clean repository.
    expect(occurrences().length).toBeGreaterThan(0);
  });

  it("every production `unknown` carrier is accounted for", () => {
    const unaccounted = occurrences().filter((site) => !(site in ACCOUNTED));

    expect(unaccounted).toEqual([]);
  });

  it("every accounted row still exists", () => {
    // The other direction: a row kept after its site is gone is an exemption
    // nobody will notice is stale, which is how the roster rots.
    const live = new Set(occurrences());
    const orphaned = Object.keys(ACCOUNTED).filter((site) => !live.has(site));

    expect(orphaned).toEqual([]);
  });
});
