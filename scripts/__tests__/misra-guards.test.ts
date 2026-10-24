/**
 * Unit tests for MisraGuards (#1610): every Enforced or By Design row of
 * docs/misra-compliance.md names a guard that exists. Each case hands it a
 * repository wrong in exactly one way.
 */

import MisraGuards from "../misra-guards/MisraGuards";
import type IMisraGuardContext from "../misra-guards/types/IMisraGuardContext";
import type TMisraGuard from "../misra-guards/types/TMisraGuard";

const DOCUMENT = [
  "| Rule | Description | Status | Reference |",
  "| ---- | ----------- | ------ | --------- |",
  "| 11.9 | NULL for null pointer constant | **By Design** | NULL handling |",
  "| 15.1 | goto shall not be used | **By Design** | ADR-028 |",
  "| 16.6 | At least two switch clauses | **Enforced** | E0712 |",
  "| 2.1 | Unreachable code | Not Enforced | |",
].join("\n");

const CONTEXT: IMisraGuardContext = {
  baselined: new Set(["misra-c2012-2.2"]),
  dumpRules: ["misra-c2012-11.9"],
  compileProbe:
    "probe.cpp: 1:23: error: zero as null pointer constant [-Werror=zero-as-null-pointer-constant]",
  openIssues: new Set([2312]),
  assertedCodes: new Set(["E0712"]),
  scripts: new Set(["test"]),
};

const REGISTRY = new Map<string, readonly TMisraGuard[]>([
  [
    "11.9",
    [
      { kind: "cppcheck" },
      { kind: "dump", rule: "misra-c2012-11.9" },
      { kind: "compile-flag", flag: "-Wzero-as-null-pointer-constant" },
    ],
  ],
  ["15.1", [{ kind: "cppcheck" }]],
  ["16.6", [{ kind: "diagnostic", code: "E0712" }]],
]);

function without(id: string): Map<string, readonly TMisraGuard[]> {
  const registry = new Map(REGISTRY);
  registry.delete(id);
  return registry;
}

function details(
  registry: ReadonlyMap<string, readonly TMisraGuard[]>,
  context: IMisraGuardContext = CONTEXT,
): string[] {
  return MisraGuards.evaluate(DOCUMENT, registry, context).violations.map(
    (violation) => `${violation.id}: ${violation.detail}`,
  );
}

describe("MisraGuards.evaluate", () => {
  it("passes when every compliance claim names a guard that exists", () => {
    expect(details(REGISTRY)).toEqual([]);
  });

  it("fails a By Design row with no guard (the #1610 shape)", () => {
    expect(details(without("11.9"))).toEqual([
      "11.9: claims compliance but names no guard in MISRA_GUARDS",
    ]);
  });

  it("fails an Enforced row with no guard", () => {
    expect(details(without("16.6"))).toEqual([
      "16.6: claims compliance but names no guard in MISRA_GUARDS",
    ]);
  });

  it("fails an entry for a row that does not claim compliance", () => {
    const registry = new Map(REGISTRY).set("2.1", [{ kind: "cppcheck" }]);
    expect(details(registry)).toEqual([
      "2.1: has a guard but its row is not Enforced or By Design; remove the entry",
    ]);
  });

  it("does not count a guard list that is empty", () => {
    const registry = new Map(REGISTRY).set("15.1", []);
    expect(details(registry)).toEqual([
      "15.1: claims compliance but names no guard in MISRA_GUARDS",
    ]);
  });

  it("reads the rows it checks", () => {
    expect(
      MisraGuards.evaluate(DOCUMENT, REGISTRY, CONTEXT).rows.map(
        (row) => `${row.id} ${row.status}`,
      ),
    ).toEqual([
      "11.9 By Design",
      "15.1 By Design",
      "16.6 Enforced",
      "2.1 Not Enforced",
    ]);
  });
});

describe("MisraGuards.problem", () => {
  it("rejects cppcheck for a baselined rule", () => {
    expect(MisraGuards.problem("2.2", { kind: "cppcheck" }, CONTEXT)).toMatch(
      /baselined/,
    );
  });

  it("rejects cppcheck for a directive", () => {
    expect(
      MisraGuards.problem("Dir 4.6", { kind: "cppcheck" }, CONTEXT),
    ).toMatch(/no directive/);
  });

  it("checks the named rule when a row borrows another's", () => {
    expect(
      MisraGuards.problem("22.2", { kind: "cppcheck", rule: "2.2" }, CONTEXT),
    ).toMatch(/2\.2 is baselined/);
  });

  it("rejects a dump rule MisraDump does not check", () => {
    expect(
      MisraGuards.problem(
        "15.6",
        { kind: "dump", rule: "misra-c2012-15.6" },
        CONTEXT,
      ),
    ).toMatch(/MisraDump checks no/);
  });

  it("rejects a compile flag the probe compile did not fail with", () => {
    expect(
      MisraGuards.problem(
        "11.9",
        { kind: "compile-flag", flag: "-Wold-style-cast" },
        CONTEXT,
      ),
    ).toMatch(/does not reject the probe with -Wold-style-cast/);
  });

  it("rejects a diagnostic no .expected.error asserts", () => {
    expect(
      MisraGuards.problem(
        "16.7",
        { kind: "diagnostic", code: "E0711" },
        CONTEXT,
      ),
    ).toMatch(/no \.expected\.error asserts E0711/);
  });

  it("rejects a script package.json does not define", () => {
    expect(
      MisraGuards.problem(
        "Dir 2.1",
        { kind: "script", script: "nope" },
        CONTEXT,
      ),
    ).toMatch(/no "nope" script/);
  });

  it("accepts an open issue", () => {
    expect(
      MisraGuards.problem("Dir 3.1", { kind: "issue", issue: 2312 }, CONTEXT),
    ).toBeNull();
  });

  it("rejects a closed issue: a row stays unguarded after its tracker closes", () => {
    expect(
      MisraGuards.problem("8.5", { kind: "issue", issue: 1064 }, CONTEXT),
    ).toBe("issue #1064 is closed; replace it with the guard it delivered");
  });

  it("rejects an issue guard with no number", () => {
    expect(
      MisraGuards.problem("Dir 3.1", { kind: "issue", issue: 0 }, CONTEXT),
    ).toMatch(/no issue number/);
  });
});

describe("MisraGuards.issues", () => {
  it("lists each issue an issue guard names, once", () => {
    const registry = new Map<string, readonly TMisraGuard[]>([
      ["Dir 3.1", [{ kind: "issue", issue: 2312 }]],
      ["Dir 4.1", [{ kind: "issue", issue: 2313 }]],
      ["9.2", [{ kind: "cppcheck" }, { kind: "issue", issue: 2312 }]],
    ]);
    expect(MisraGuards.issues(registry).sort()).toEqual([2312, 2313]);
  });
});

describe("MisraGuards.addonRules", () => {
  it("lists each rule a cppcheck guard relies on, including borrowed ones", () => {
    const registry = new Map(REGISTRY).set("22.2", [
      { kind: "cppcheck", rule: "21.3" },
    ]);
    expect(MisraGuards.addonRules(registry).sort()).toEqual([
      "11.9",
      "15.1",
      "21.3",
    ]);
  });
});
