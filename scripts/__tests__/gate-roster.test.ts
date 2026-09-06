import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import GateRoster from "../gate-roster/GateRoster";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Every rule gets a mutation: a fixture that breaks exactly one property and an
 * assertion that the rule fires. A check whose tests only feed it correct input
 * proves that it can pass, which is the failure mode this whole check exists to
 * catch -- so proving it can FAIL is the point of the file.
 */
const GATE = [
  "#!/bin/bash",
  "# not-in-gate: antlr:all  regenerates the parser",
  "run_check() {",
  "  :",
  "}",
  'run_check "Static Analysis" "prettier:check"   npm run prettier:check',
  'run_check "Build" "build"                      npm run build',
  'run_check "Unit Tests" "unit"                  npm run unit',
  'run_check "Integration Tests" "test"           npm test',
  'run_check "C Static Analysis" "validate:c"     npm run validate:c',
].join("\n");

const WORKFLOW = [
  "jobs:",
  "  lint:",
  "    steps:",
  "      - name: Install",
  "        run: npm ci",
  "      - name: Format",
  "        run: npm run prettier:check",
  "      - name: Build",
  "        run: npm run build",
  "      - name: Unit",
  "        run: npm run unit -- --coverage",
  "      - name: Integration",
  "        run: npm test",
  "      - name: Validate",
  "        run: npm run validate:c",
  "      - name: Parser",
  "        run: npm run antlr:all",
].join("\n");

const CLAUDE = [
  "**`test:all` is four checks of five — run `npm run test:gate` before pushing.**",
  "`test:all` is `build && unit && test:q && validate:c`. CI runs one more with no local",
  "alias: `prettier:check`, and the `test` and `validate:c` and `build` and `unit` checks.",
].join("\n");

function kinds(gate: string, workflow: string, claude: string): string[] {
  return GateRoster.evaluate(gate, workflow, claude).violations.map(
    (violation) => violation.kind,
  );
}

describe("GateRoster.numeralToInt", () => {
  it("reads plain and hyphenated numerals", () => {
    expect(GateRoster.numeralToInt("four")).toBe(4);
    expect(GateRoster.numeralToInt("twenty")).toBe(20);
    expect(GateRoster.numeralToInt("twenty-nine")).toBe(29);
  });

  it("returns null rather than guessing at an unreadable numeral", () => {
    expect(GateRoster.numeralToInt("twenty-twenty")).toBeNull();
    expect(GateRoster.numeralToInt("29")).toBeNull();
    expect(GateRoster.numeralToInt("")).toBeNull();
  });
});

describe("GateRoster.gateInvocations", () => {
  it("counts invocations and not the function definition", () => {
    // The definition is why `grep -c '^run_check'` was wrong: it matched
    // `run_check() {` too, and that error cancelled against a missed check.
    expect(GateRoster.gateInvocations(GATE)).toHaveLength(5);
  });

  it("joins a continuation so a wrapped run_check is one invocation", () => {
    const wrapped = ['run_check "J" "n" \\', "  bash -c 'npm run thing'"].join(
      "\n",
    );
    expect(GateRoster.gateInvocations(wrapped)).toHaveLength(1);
    expect(GateRoster.scriptsIn(wrapped)).toContain("thing");
  });
});

describe("GateRoster.scriptsIn", () => {
  it("normalizes npm run, npm test and npx", () => {
    const found = GateRoster.scriptsIn(
      "npm run a:b -- --flag\nnpm test\nnpx knip",
    );
    expect(found).toEqual(expect.arrayContaining(["a:b", "test", "npx:knip"]));
  });

  it("ignores a script named in output rather than executed", () => {
    // The workflow echoes "run 'npm run test:update' first" as remediation
    // advice. Reading that as an executed check reported a missing gate entry
    // for a command CI never invokes.
    expect(
      GateRoster.scriptsIn(`echo "run 'npm run test:update' first"`),
    ).toEqual([]);
    expect(GateRoster.scriptsIn("# npm run commented:out")).toEqual([]);
  });
});

describe("GateRoster.workflowScripts", () => {
  it("reads inline and block run steps", () => {
    const block = [
      "      - name: Two things",
      "        run: |",
      "          npm run first",
      "          npm run second",
      "      - name: After",
      "        run: npm run third",
    ].join("\n");
    expect(GateRoster.workflowScripts(block)).toEqual(
      expect.arrayContaining(["first", "second", "third"]),
    );
  });

  it("does not treat npm ci as a check", () => {
    expect(GateRoster.workflowScripts("        run: npm ci")).toEqual([]);
  });
});

describe("GateRoster.evaluate", () => {
  it("is clean when the roster matches what runs", () => {
    expect(kinds(GATE, WORKFLOW, CLAUDE)).toEqual([]);
  });

  it("fires count-mismatch when the numeral drifts", () => {
    const stale = CLAUDE.replace("four checks of five", "four checks of four");
    expect(kinds(GATE, WORKFLOW, stale)).toContain("count-mismatch");
  });

  it("fires count-mismatch when the remainder sentence drifts", () => {
    const stale = CLAUDE.replace("CI runs one more", "CI runs seven more");
    expect(kinds(GATE, WORKFLOW, stale)).toContain("count-mismatch");
  });

  it("fires count-mismatch when the sentence cannot be read at all", () => {
    expect(kinds(GATE, WORKFLOW, "no roster here")).toContain("count-mismatch");
  });

  it("fires missing-from-gate when CI gains a check the gate lacks", () => {
    // This is the drift that actually happened: `headers:standalone:check`
    // reached the workflow and neither gate.sh nor the roster.
    const grown = `${WORKFLOW}\n      - name: New\n        run: npm run brand:new`;
    expect(kinds(GATE, grown, CLAUDE)).toContain("missing-from-gate");
  });

  it("does not fire missing-from-gate for an excluded script", () => {
    // antlr:all is in the workflow and in the gate's not-in-gate list.
    expect(kinds(GATE, WORKFLOW, CLAUDE)).not.toContain("missing-from-gate");
  });

  it("fires stale-exclusion when an exclusion names a script CI dropped", () => {
    const dropped = WORKFLOW.replace("        run: npm run antlr:all", "");
    expect(kinds(GATE, dropped, CLAUDE)).toContain("stale-exclusion");
  });

  it("fires roster-mismatch when a gate check is never named", () => {
    const grown = `${GATE}\n${'run_check "J" "unnamed:check"  npm run unnamed:check'}`;
    const both = `${WORKFLOW}\n      - name: U\n        run: npm run unnamed:check`;
    expect(kinds(grown, both, CLAUDE)).toContain("roster-mismatch");
  });
});

describe("the repository's own roster", () => {
  it("matches what gate.sh actually runs", () => {
    const outcome = GateRoster.evaluate(
      readFileSync(join(repoRoot, "scripts", "gate.sh"), "utf-8"),
      readFileSync(
        join(repoRoot, ".github", "workflows", "pr-checks.yml"),
        "utf-8",
      ),
      readFileSync(join(repoRoot, "CLAUDE.md"), "utf-8"),
    );
    expect(outcome.violations).toEqual([]);
  });

  it("parses a non-empty roster, so an empty scan cannot read as clean", () => {
    // A selector that matches nothing reports a perfect repository. The CLI
    // exits non-zero on this; asserting it here keeps the property when the
    // CLI's own output is not being read.
    const outcome = GateRoster.evaluate(
      readFileSync(join(repoRoot, "scripts", "gate.sh"), "utf-8"),
      readFileSync(
        join(repoRoot, ".github", "workflows", "pr-checks.yml"),
        "utf-8",
      ),
      readFileSync(join(repoRoot, "CLAUDE.md"), "utf-8"),
    );
    expect(outcome.checkCount).toBeGreaterThan(20);
    expect(outcome.workflowScripts.length).toBeGreaterThan(20);
  });
});
