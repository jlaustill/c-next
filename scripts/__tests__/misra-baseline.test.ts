/**
 * Unit tests for misra-baseline.mjs
 *
 * Regression guard for #1057: the MISRA portion of `validate:c` was a silent
 * no-op because runMisra() invoked cppcheck without `--enable=style`, and
 * cppcheck emits all MISRA findings at `style` severity. These tests lock in:
 *   1. the cppcheck argv always enables style (so MISRA findings appear),
 *   2. MISRA violations are parsed from output (ignoring non-MISRA noise),
 *   3. only violations of un-baselined rules are treated as failures.
 */

import MisraBaseline from "../misra-baseline.mjs";

// Real cppcheck output captured with `--enable=style`. Mixes MISRA findings
// with non-MISRA style findings to prove the parser ignores the latter.
const SAMPLE_OUTPUT = `probe.c:3:14: style: Assignment of function parameter has no effect outside the function. [uselessAssignmentArg]
probe.c:3:16: style: Variable 'x' is assigned a value that is never used. [unreadVariable]
probe.c:2:6: style: misra violation (use --rule-texts=<file> to get proper output) [misra-c2012-8.4]
probe.c:3:8: style: misra violation (use --rule-texts=<file> to get proper output) [misra-c2012-14.4]
probe.c:4:8: style: misra violation (use --rule-texts=<file> to get proper output) [misra-c2012-14.4]`;

describe("buildArgs", () => {
  it("enables style so cppcheck emits MISRA findings (the #1057 bug)", () => {
    const args = MisraBaseline.buildArgs("foo.test.c", "tests/include");
    expect(args).toContain("--enable=style");
  });

  it("loads the MISRA addon and targets the given file", () => {
    const args = MisraBaseline.buildArgs("foo.test.c", "tests/include");
    expect(args).toContain("--addon=misra");
    expect(args).toContain("foo.test.c");
  });
});

describe("parseViolations", () => {
  it("extracts MISRA rule IDs and ignores non-MISRA style findings", () => {
    const violations = MisraBaseline.parseViolations(SAMPLE_OUTPUT);
    expect(violations.map((v) => v.ruleId)).toEqual([
      "misra-c2012-8.4",
      "misra-c2012-14.4",
      "misra-c2012-14.4",
    ]);
  });

  it("returns an empty array when there are no MISRA findings", () => {
    const noise =
      "probe.c:1:1: style: Variable unused. [unreadVariable]\n" +
      "probe.c:2:2: warning: something. [someWarning]";
    expect(MisraBaseline.parseViolations(noise)).toEqual([]);
  });
});

describe("isGenerated", () => {
  it("treats *.test.c and *.test.h as C-Next-generated", () => {
    expect(MisraBaseline.isGenerated("tests/foo/bar.test.c")).toBe(true);
    expect(MisraBaseline.isGenerated("tests/foo/bar.test.h")).toBe(true);
  });

  it("treats hand-written fixtures and third-party headers as external", () => {
    // cppcheck reports violations in transitively-included headers; these are
    // NOT C-Next output and must not gate the build (#1057 refinement).
    expect(MisraBaseline.isGenerated("tests/libs/cJSON/cJSON.h")).toBe(false);
    expect(MisraBaseline.isGenerated("tests/include/c-interop/enums.h")).toBe(
      false,
    );
  });
});

describe("findFailures", () => {
  it("fails only on un-baselined rules in generated files", () => {
    const violations = [
      { file: "a.test.c", ruleId: "misra-c2012-10.4", raw: "x" }, // baselined (#858)
      { file: "a.test.c", ruleId: "misra-c2012-99.9", raw: "y" }, // new rule → fail
      { file: "cJSON.h", ruleId: "misra-c2012-99.9", raw: "z" }, // external → ignore
    ];
    const failures = MisraBaseline.findFailures(violations);
    expect(failures.map((v) => v.raw)).toEqual(["y"]);
  });
});

describe("BASELINE integrity", () => {
  it("baselines a rule that currently has violations (10.4 → #858)", () => {
    expect(MisraBaseline.BASELINE.has("misra-c2012-10.4")).toBe(true);
  });

  it("does NOT baseline a rule with zero current violations (10.3)", () => {
    // #845 tracks Rule 10.3 but it no longer fires; the check must still catch
    // it if it ever reappears, so it must stay out of the baseline.
    expect(MisraBaseline.BASELINE.has("misra-c2012-10.3")).toBe(false);
  });
});
