/**
 * Unit tests for misra-dump.ts (#1610): the Rule 11.9 shape cppcheck's addon
 * cannot see. The dump lines are cppcheck's own, trimmed to the attributes
 * the check reads, from the issue-opaque-handle-positions fixture as `main`
 * generated it before #1610.
 */

import MisraDump from "../misra-dump";

const FILE = "tests/bugs/issue-opaque-handle-positions/file-scope-var.test.c";

/** `<token>` line for one token of the split `name = { 0 } ;` statement */
function token(str: string, extra = ""): string {
  return `    <token id="t-${str}" file="${FILE}" linenr="29" column="6" str="${str}" ${extra}/>`;
}

function dump(
  name: string,
  variable: string,
  zero: string,
  vars: string,
): string {
  return [
    '<dump cfg="">',
    "  <tokenlist>",
    token(name, `type="name" variable="${variable}"`),
    token(";", 'isSplittedVarDeclEq="true"'),
    token(name, `type="name" variable="${variable}"`),
    token("=", 'type="op" isAssignmentOp="true"'),
    token("{"),
    token(zero, 'type="number" isInt="true"'),
    token("}"),
    token(";"),
    "  </tokenlist>",
    "  <variables>",
    vars,
    "  </variables>",
    "</dump>",
  ].join("\n");
}

const SCALAR_POINTER =
  '    <var id="v1" nameToken="t-gdev" access="Global" isArray="false" isClass="false" isPointer="true" isReference="false"/>';
const POINTER_ARRAY =
  '    <var id="v1" nameToken="t-gdevs" access="Global" isArray="true" isClass="true" isPointer="false" isReference="false"/>';
const SCALAR_INTEGER =
  '    <var id="v1" nameToken="t-count" access="Global" isArray="false" isClass="false" isPointer="false" isReference="false"/>';

describe("MisraDump.findings", () => {
  it("reports a scalar pointer initialized with {0} as Rule 11.9", () => {
    const findings = MisraDump.findings(
      dump("gdev", "v1", "0", SCALAR_POINTER),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      file: FILE,
      ruleId: "misra-c2012-11.9",
    });
    expect(findings[0]!.raw).toMatch(
      /^tests\/bugs\/.*file-scope-var\.test\.c:29:6: .*'gdev'.*\[misra-c2012-11\.9\]$/,
    );
  });

  it("reports a suffixed integer zero too", () => {
    expect(
      MisraDump.findings(dump("gdev", "v1", "0U", SCALAR_POINTER)),
    ).toHaveLength(1);
  });

  it("allows {0} for an array of pointers, an aggregate 11.9 exempts (#996)", () => {
    expect(MisraDump.findings(dump("gdevs", "v1", "0", POINTER_ARRAY))).toEqual(
      [],
    );
  });

  it("allows {0} for a variable that is not a pointer", () => {
    expect(
      MisraDump.findings(dump("count", "v1", "0", SCALAR_INTEGER)),
    ).toEqual([]);
  });

  it("allows a non-zero brace initializer", () => {
    expect(MisraDump.findings(dump("gdev", "v1", "1", SCALAR_POINTER))).toEqual(
      [],
    );
  });

  it("reads nothing from an empty dump (a file cppcheck did not analyze)", () => {
    expect(MisraDump.findings("")).toEqual([]);
  });

  it("names the rules it checks, for the guard registry", () => {
    expect(MisraDump.RULES).toEqual(["misra-c2012-11.9"]);
  });
});
