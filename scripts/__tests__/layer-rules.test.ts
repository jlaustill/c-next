/**
 * Issue #1297: the layer rules in `.dependency-cruiser.cjs` must be transitive.
 *
 * A layer rule is a claim about REACHABILITY -- "nothing in `logic/` may end up
 * depending on `output/`" -- but dependency-cruiser matches DIRECT edges unless
 * a rule opts into `reachable: true`. The two readings differ by exactly one
 * indirection, so a direct-only layer rule reports green while the coupling it
 * forbids is already in place: `logic/ -> state/ -> output/` satisfied
 * `logic-cannot-import-output` for as long as the rule existed, and CI printed
 * `no dependency violations found` over ten transitively coupled analyzers.
 *
 * The failure mode is that the rule LOOKS enforced. Nothing is missing from the
 * config, no check is skipped, and the guard is cited in CLAUDE.md as the thing
 * keeping the layers honest -- it is simply answering a narrower question than
 * the one its name asks. That cannot be caught by reading the file, because the
 * absent keyword is invisible; it is only caught by asking every layer rule the
 * same question mechanically, which is what this file does.
 *
 * `reachable: true` is NOT correct for every rule, and this test deliberately
 * does not ask for it. `collectors-build-names-from-scopes` forbids importing
 * one specific utility module, which is a claim about direct authorship -- made
 * transitive it produces seven errors, because everything reaches that module
 * through `utils/`. The discriminator is the rule's SHAPE: a rule whose `from`
 * and `to` are both inside a layer root is a layering claim; one that names a
 * single module outside the layers is not. See the negative control below.
 */

import { join } from "node:path";

const CONFIG_PATH = join(__dirname, "..", "..", ".dependency-cruiser.cjs");

/**
 * The roots a layering claim can be made about.
 *
 * `^src/PARSE/` joined the list when #1472/#1447 moved 1.3 Declare and 1.4
 * Resolve out of `src/transpiler/logic/symbols/`. Adding it is not cosmetic:
 * with only the transpiler root here, a rule about the pass tree is not
 * RECOGNIZED as a layering claim, so it could ship without `reachable: true`
 * and this file -- whose entire purpose is to catch that -- would pass over it.
 * That is #1297 one level up, and it is the failure the move itself would
 * otherwise have caused in silence.
 */
const LAYER_ROOTS = ["^src/transpiler/", "^src/PARSE/"];

interface IRuleEnd {
  path?: string | string[];
  reachable?: boolean;
}

interface IRule {
  name?: string;
  from?: IRuleEnd;
  to?: IRuleEnd;
}

const paths = (end: IRuleEnd | undefined): string[] => {
  const value = end?.path;
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value;
  return [];
};

/**
 * A layering claim: every path on BOTH ends is inside a layer root.
 *
 * Normalizing arrays matters -- a rule listing several source directories is
 * still a layering claim, and reading only `typeof path === "string"` would let
 * it slip past this assertion silently.
 */
const isLayerRule = (rule: IRule): boolean => {
  const from = paths(rule.from);
  const to = paths(rule.to);

  if (from.length === 0 || to.length === 0) return false;

  return [...from, ...to].every((path) =>
    LAYER_ROOTS.some((root) => path.startsWith(root)),
  );
};

const layerRules = (): IRule[] => {
  const config: unknown = require(CONFIG_PATH);
  const forbidden = (config as { forbidden?: unknown }).forbidden;

  if (!Array.isArray(forbidden)) {
    throw new Error(".dependency-cruiser.cjs has no `forbidden` array");
  }

  return (forbidden as IRule[]).filter(isLayerRule);
};

describe("dependency-cruiser layer rules (#1297)", () => {
  it("finds the layer rules at all", () => {
    // Guards the selector itself. If the path convention changes and this
    // returns nothing, "every layer rule is transitive" passes over an empty
    // list -- the same defect as #1297, one level up.
    expect(layerRules().length).toBeGreaterThanOrEqual(6);
  });

  it("every layer rule is transitive", () => {
    const directOnly = layerRules()
      .filter((rule) => rule.to?.reachable !== true)
      .map((rule) => rule.name ?? "(unnamed)");

    expect(directOnly).toEqual([]);
  });

  it("names every rule it is asserting over", () => {
    // Fails loudly if a layer rule is renamed or removed, so the set under
    // assertion stays visible rather than quietly shrinking.
    const names = layerRules().map((rule) => rule.name);

    expect(names.sort()).toEqual([
      "data-cannot-import-logic",
      "data-cannot-import-output",
      "declare-cannot-import-resolve",
      "logic-cannot-import-output",
      "parse-cannot-import-render",
      "state-cannot-import-output",
    ]);
  });

  it("does not demand reachability of a rule targeting one module", () => {
    // Negative control. `collectors-build-names-from-scopes` forbids importing
    // `src/utils/QualifiedCName.ts`; under `reachable: true` it produces seven
    // errors, because every listed directory reaches that module through
    // `utils/`. A test that swept it in would be asking for a config that
    // cannot pass, so the exclusion is asserted rather than left implicit.
    const names = layerRules().map((rule) => rule.name);

    expect(names).not.toContain("collectors-build-names-from-scopes");
  });
});
