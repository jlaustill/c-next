import { describe, expect, it } from "vitest";

import ModuleDestinations from "../module-destinations/ModuleDestinations";

function check(
  markdown: string,
  files: readonly string[],
  baseline: readonly string[] = [],
) {
  return ModuleDestinations.checkOutcome(markdown, files, baseline);
}

function kinds(markdown: string, files: string[], baseline: string[] = []) {
  return check(markdown, files, baseline).failures.map(
    (f) => `${f.kind} ${f.subject}`,
  );
}

const PLAN = [
  "### 2.2 Plan — `src/TRANSPILE/2-Plan/`",
  "",
  "| module | why |",
  "| --- | --- |",
  "| `EmissionPlan.ts` | the artifact |",
  "| `helpers/**` | helpers |",
].join("\n");

const AWAITING = [
  "## Awaiting a pass",
  "",
  "| module | destination | why |",
  "| --- | --- | --- |",
  "| `src/transpiler/data/**` | `src/PARSE/1-Discover/`, awaiting #1444 | discovery |",
].join("\n");

describe("ModuleDestinations.population", () => {
  it("keeps non-test TypeScript under src/ only", () => {
    expect(
      ModuleDestinations.population([
        "src/a/Kept.ts",
        "src/index.ts",
        "src/a/__tests__/Helper.ts",
        "src/a/__testUtils__/testMembers.ts",
        "src/a/Thing.test.ts",
        "src/a/Thing.mocked.test.ts",
        "src/a/fixtures/x.h",
        "src/a/grammar/CNext.tokens",
        "scripts/Tool.ts",
      ]),
    ).toEqual(["src/a/Kept.ts", "src/index.ts"]);
  });
});

describe("ModuleDestinations.checkOutcome", () => {
  it("is green when every module has a row and every row matches", () => {
    expect(
      kinds(PLAN, [
        "src/TRANSPILE/2-Plan/EmissionPlan.ts",
        "src/TRANSPILE/2-Plan/helpers/deep/One.ts",
      ]),
    ).toEqual([]);
  });

  it("fails on a module no row covers", () => {
    expect(
      kinds(PLAN, [
        "src/TRANSPILE/2-Plan/EmissionPlan.ts",
        "src/TRANSPILE/2-Plan/helpers/One.ts",
        "src/TRANSPILE/2-Plan/Unplaced.ts",
      ]),
    ).toEqual(["no-row src/TRANSPILE/2-Plan/Unplaced.ts"]);
  });

  it("fails on a row that matches no module", () => {
    expect(kinds(PLAN, ["src/TRANSPILE/2-Plan/helpers/One.ts"])).toEqual([
      "unmatched-row src/TRANSPILE/2-Plan/EmissionPlan.ts",
    ]);
  });

  it("resolves a row against the nearest heading's directory, not an outer one", () => {
    const markdown = [
      "## TRANSPILE — `src/TRANSPILE/`",
      "",
      "### 2.2 Plan — `src/TRANSPILE/2-Plan/`",
      "",
      "| module | why |",
      "| --- | --- |",
      "| `EmissionPlan.ts` | the artifact |",
    ].join("\n");
    expect(kinds(markdown, ["src/TRANSPILE/EmissionPlan.ts"])).toEqual([
      "no-row src/TRANSPILE/EmissionPlan.ts",
      "unmatched-row src/TRANSPILE/2-Plan/EmissionPlan.ts",
    ]);
  });

  it("reads every path in a module cell", () => {
    const markdown = [
      "### 1.2 Parse — `src/PARSE/2-Parse/`",
      "",
      "| module | why |",
      "| --- | --- |",
      "| `c/grammar/**`, `cpp/grammar/**` | generated |",
    ].join("\n");
    expect(
      kinds(markdown, [
        "src/PARSE/2-Parse/c/grammar/CParser.ts",
        "src/PARSE/2-Parse/cpp/grammar/CPP14Parser.ts",
      ]),
    ).toEqual([]);
  });

  it("keys a destination table on the destination, which is the current path", () => {
    const markdown = [
      "## Instrumentation",
      "",
      "| module | destination | why |",
      "| --- | --- | --- |",
      "| `state/AdrProvenance.ts` | `src/instrumentation/AdrProvenance.ts` | a sink |",
    ].join("\n");
    expect(kinds(markdown, ["src/instrumentation/AdrProvenance.ts"])).toEqual(
      [],
    );
  });

  it("does not fail on an awaiting row the baseline holds", () => {
    expect(
      kinds(
        AWAITING,
        ["src/transpiler/data/IncludeResolver.ts"],
        ["src/transpiler/data/**"],
      ),
    ).toEqual([]);
  });

  it("fails when the awaiting set grows past the baseline", () => {
    expect(
      kinds(AWAITING, ["src/transpiler/data/IncludeResolver.ts"], []),
    ).toEqual(["awaiting-grew src/transpiler/data/**"]);
  });

  it("fails on a baseline entry that is no longer an awaiting row", () => {
    expect(
      kinds(
        AWAITING,
        ["src/transpiler/data/IncludeResolver.ts"],
        ["src/transpiler/data/**", "src/transpiler/types/**"],
      ),
    ).toEqual(["baseline-stale src/transpiler/types/**"]);
  });

  it("holds an awaiting row to the modules it names, like any other row", () => {
    expect(
      kinds(AWAITING, ["src/transpiler/Other.ts"], ["src/transpiler/data/**"]),
    ).toEqual([
      "no-row src/transpiler/Other.ts",
      "unmatched-row src/transpiler/data/**",
    ]);
  });

  it("fails on a module one row places and another says is awaiting a move", () => {
    const markdown = [
      "## Layer-neutral — `src/utils/`",
      "",
      "| module | why |",
      "| --- | --- |",
      "| `**` | in place |",
      "",
      "## Awaiting a move",
      "",
      "| module | destination | why |",
      "| --- | --- | --- |",
      "| `src/utils/ChainRoot.ts` | `src/types/`, awaiting #1443 | moves |",
    ].join("\n");
    expect(
      kinds(
        markdown,
        ["src/utils/ChainRoot.ts", "src/utils/Other.ts"],
        ["src/utils/ChainRoot.ts"],
      ),
    ).toEqual(["conflicting-rows src/utils/ChainRoot.ts"]);
  });

  it("fails on two awaiting rows naming one card but different destinations", () => {
    const markdown = [
      "## Awaiting a move",
      "",
      "| module | destination | why |",
      "| --- | --- | --- |",
      "| `src/transpiler/types/**` | `src/types/`, awaiting #1443 | shared |",
      "| `src/transpiler/types/IRunAnchor.ts` | `src/cli/`, awaiting #1443 | orchestrator |",
    ].join("\n");
    expect(
      kinds(
        markdown,
        [
          "src/transpiler/types/IRunAnchor.ts",
          "src/transpiler/types/IShared.ts",
        ],
        ["src/transpiler/types/**", "src/transpiler/types/IRunAnchor.ts"],
      ),
    ).toEqual(["conflicting-rows src/transpiler/types/IRunAnchor.ts"]);
  });

  it("allows two awaiting rows that name the same card and destination", () => {
    const markdown = [
      "## Awaiting a move",
      "",
      "| module | destination | why |",
      "| --- | --- | --- |",
      "| `src/transpiler/data/**` | `src/PARSE/1-Discover/`, awaiting #1444 | discovery |",
      "| `src/transpiler/data/FileDiscovery.ts` | `src/PARSE/1-Discover/`, awaiting #1444 | its own why |",
    ].join("\n");
    expect(
      kinds(
        markdown,
        ["src/transpiler/data/FileDiscovery.ts"],
        ["src/transpiler/data/**", "src/transpiler/data/FileDiscovery.ts"],
      ),
    ).toEqual([]);
  });

  it("allows a specific row inside a glob row when both place the module", () => {
    const markdown = [
      "## Layer-neutral — `src/utils/`",
      "",
      "| module | why |",
      "| --- | --- |",
      "| `ChainRoot.ts` | the root of a chain |",
      "| `**` | in place |",
    ].join("\n");
    expect(kinds(markdown, ["src/utils/ChainRoot.ts"])).toEqual([]);
  });

  it("skips outcome tables, whose modules no longer exist", () => {
    const markdown = [
      "## Deleted rather than re-homed",
      "",
      "| module | outcome |",
      "| --- | --- |",
      "| `2-Plan/TypeRegistrationEngine.ts` | **Deleted.** |",
    ].join("\n");
    expect(kinds(markdown, [])).toEqual([]);
  });

  it("fails on a relative row under a heading that names no directory", () => {
    const markdown = [
      "## Blocked",
      "",
      "| module | why |",
      "| --- | --- |",
      "| `cnext/adapters/TSymbolInfoAdapter.ts` | half done |",
    ].join("\n");
    expect(kinds(markdown, [])).toEqual([
      "unresolvable-row cnext/adapters/TSymbolInfoAdapter.ts",
    ]);
  });

  it("reports the line a failing row sits on", () => {
    const outcome = check(PLAN, ["src/TRANSPILE/2-Plan/helpers/One.ts"]);
    expect(outcome.failures.map((f) => f.line)).toEqual([5]);
  });

  it("counts the population, the rows and the awaiting rows", () => {
    const outcome = check(
      `${PLAN}\n\n${AWAITING}`,
      [
        "src/TRANSPILE/2-Plan/EmissionPlan.ts",
        "src/TRANSPILE/2-Plan/helpers/One.ts",
        "src/transpiler/data/IncludeResolver.ts",
      ],
      ["src/transpiler/data/**"],
    );
    expect([outcome.modules, outcome.rows, outcome.awaiting]).toEqual([
      3, 3, 1,
    ]);
  });
});
