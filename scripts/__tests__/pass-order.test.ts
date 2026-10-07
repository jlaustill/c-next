/**
 * The `*-reads-no-later-pass` rules, run against fixtures (#1443 box 5).
 *
 * `layer-rules.test.ts` checks the rules' SHAPE -- named, transitive, paths that
 * still match a file. None of that shows a rule can fail on the edge it exists
 * to catch, which is the defect #1297 fixed. So each place in the order gets one
 * fixture module, and depcruise runs the real generated rules over three trees:
 *
 * - forward: every place imports every later place -- each rule must fire on
 *   exactly its later places, no more and no fewer;
 * - backward: every place imports every earlier place -- the allowed direction,
 *   which must stay green (the control);
 * - through a util: 1.1 reaches 3.1 only via `src/utils/` -- `reachable` must
 *   catch it;
 * - the one ruled edge: 1.1 may read 1.2's lexer (#1745) and still not its
 *   parser, which sits beside it.
 */
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

import Depcruise from "../utils/Depcruise";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const configPath = join(repoRoot, ".dependency-cruiser.cjs");
const ORDER_RULE = /-reads-no-later-pass$/;

interface IOrderRule {
  readonly name: string;
  readonly from: { readonly path: string };
  readonly to: { readonly path: readonly string[]; readonly pathNot?: string };
}

const rules = (
  createRequire(import.meta.url)(configPath) as {
    forbidden: Array<{ name: string }>;
  }
).forbidden.filter((rule) => ORDER_RULE.test(rule.name)) as IOrderRule[];

/** The order itself: the first rule's place, then every place it may not reach. */
const places = [rules[0].from.path, ...rules[0].to.path];

/** One concrete module a place's pattern matches: its first alternative. */
const sample = (pattern: string): string => {
  const path = pattern
    .replace(/^\^/, "")
    .replace(/\(([^|)]*)\|[^)]*\)/, "$1")
    .replaceAll("\\.", ".")
    .replaceAll("$", "");
  return path.endsWith("/") ? `${path}Probe.ts` : path;
};

const roots: string[] = [];

/** Builds a fixture repo of `imports` (module -> modules it imports) and cruises it. */
const cruise = (imports: ReadonlyMap<string, readonly string[]>): string[] => {
  const root = mkdtempSync(join(tmpdir(), "pass-order-"));
  roots.push(root);
  symlinkSync(join(repoRoot, "node_modules"), join(root, "node_modules"));
  writeFileSync(
    join(root, ".dependency-cruiser.cjs"),
    `const config = require(${JSON.stringify(configPath)});\n` +
      "module.exports = {\n" +
      `  forbidden: config.forbidden.filter((rule) => ${ORDER_RULE}.test(rule.name)),\n` +
      "  options: { tsPreCompilationDeps: true, doNotFollow: { path: 'node_modules' } },\n" +
      "};\n",
  );
  for (const [module, targets] of imports) {
    const lines = targets.map((target, index) => {
      let specifier = relative(dirname(module), target).replace(/\.ts$/, "");
      if (!specifier.startsWith(".")) {
        specifier = `./${specifier}`;
      }
      return `import m${index} from "${specifier}";`;
    });
    const names = targets.map((_, index) => `m${index}`).join(", ");
    lines.push(`export default [${names}];`);
    mkdirSync(join(root, dirname(module)), { recursive: true });
    writeFileSync(join(root, module), `${lines.join("\n")}\n`);
  }
  return Depcruise.violations(root)
    .map((v) => `${v.rule?.name}: ${v.from} -> ${v.to}`)
    .sort();
};

afterAll(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("pass-order rules (#1443)", () => {
  it("are generated one per place, each forbidding exactly the places after it", () => {
    expect(places.length).toBeGreaterThan(2);
    expect(rules.map((rule) => rule.from.path)).toEqual(places.slice(0, -1));
    rules.forEach((rule, index) => {
      expect(rule.to.path).toEqual(places.slice(index + 1));
    });
  });

  it("each fires on every later place, and on nothing else", () => {
    const modules = places.map(sample);
    const imports = new Map(
      modules.map((module, index) => [module, modules.slice(index + 1)]),
    );
    const expected = rules
      .flatMap((rule, index) =>
        modules
          .slice(index + 1)
          .map((later) => `${rule.name}: ${modules[index]} -> ${later}`),
      )
      .sort();
    expect(cruise(imports)).toEqual(expected);
  });

  it("stays green when every place reads only earlier places (the control)", () => {
    const modules = places.map(sample);
    const imports = new Map(
      modules.map((module, index) => [module, modules.slice(0, index)]),
    );
    expect(cruise(imports)).toEqual([]);
  });

  it("catches a later pass reached through a util, not just imported", () => {
    const first = sample(places[0]);
    const last = sample(places.at(-1) ?? "");
    const imports = new Map<string, readonly string[]>([
      [first, ["src/utils/Hop.ts"]],
      ["src/utils/Hop.ts", [last]],
      [last, []],
    ]);
    expect(cruise(imports)).toEqual([`${rules[0].name}: ${first} -> ${last}`]);
  });

  it("lets 1.1 read 1.2's lexer, and only the lexer (#1745)", () => {
    expect(rules[0].to.pathNot).toBe(
      "^src/PARSE/2-Parse/grammar/CNextLexer\\.ts$",
    );
    const first = sample(places[0]);
    const lexer = "src/PARSE/2-Parse/grammar/CNextLexer.ts";
    const parser = "src/PARSE/2-Parse/grammar/CNextParser.ts";
    const imports = new Map<string, readonly string[]>([
      [first, [lexer, parser]],
      [lexer, []],
      [parser, []],
    ]);
    expect(cruise(imports)).toEqual([
      `${rules[0].name}: ${first} -> ${parser}`,
    ]);
  });
});
