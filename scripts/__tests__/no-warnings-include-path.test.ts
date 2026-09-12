/**
 * Issue #1553: `validateNoWarnings` compiled with only
 * `-I <root>/tests/include`, omitting the directory the C file itself sits in.
 * A generated header including a sibling as `<name.h>` was therefore not
 * found, and the check failed on a missing file rather than on warnings.
 *
 * It also compiled the entry translation unit alone, so a warning in a
 * helper's implementation was invisible -- the marker reporting success over
 * a file it never compiled.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

import TestUtils from "../test-utils";

// Precedent: scripts/__tests__/examples-transpile.test.ts. These cases shell
// out to gcc, and a missing compiler surfaces through validateNoWarnings's
// catch as `valid: false` -- which would fail the suite rather than skip it.
const gccAvailable =
  spawnSync("gcc", ["--version"], { encoding: "utf-8" }).status === 0;

describe.skipIf(!gccAvailable)("TestUtils.validateNoWarnings", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "no-warnings-include-path-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("resolves a header sitting beside the C file", () => {
    writeFileSync(join(tempDir, "helper.h"), "int helperValue(void);\n");
    const cFile = join(tempDir, "entry.c");
    writeFileSync(
      cFile,
      "#include <helper.h>\n\nint entryValue(void) {\n    return helperValue();\n}\n",
    );

    const result = TestUtils.validateNoWarnings(cFile, process.cwd());

    expect(result.valid).toBe(true);
  });

  it("reports a real warning rather than failing open", () => {
    const cFile = join(tempDir, "warns.c");
    writeFileSync(
      cFile,
      "int withUnusedParam(int unusedValue) {\n    return 0;\n}\n",
    );

    const result = TestUtils.validateNoWarnings(cFile, process.cwd());

    expect(result.valid).toBe(false);
    expect(result.message).toContain("unused parameter");
  });

  it("reports the warning, not the include, when a multi-file case warns", () => {
    writeFileSync(join(tempDir, "helper.h"), "int helperValue(void);\n");
    const cFile = join(tempDir, "both.c");
    writeFileSync(
      cFile,
      "#include <helper.h>\n\n" +
        "int withUnusedParam(int unusedValue) {\n    return helperValue();\n}\n",
    );

    const result = TestUtils.validateNoWarnings(cFile, process.cwd());

    expect(result.valid).toBe(false);
    expect(result.message).toContain("unused parameter");
    expect(result.message).not.toContain("No such file");
  });

  it("compiles helper implementations, not the entry alone", () => {
    const cFile = join(tempDir, "entry.c");
    writeFileSync(cFile, "int entryValue(void) {\n    return 0;\n}\n");
    const helperImpl = join(tempDir, "helper.c");
    writeFileSync(
      helperImpl,
      "int helperValue(int unusedValue) {\n    return 0;\n}\n",
    );

    // The entry alone is clean, so this passes iff the helper is compiled too.
    const entryOnly = TestUtils.validateNoWarnings(cFile, process.cwd());
    expect(entryOnly.valid).toBe(true);

    const withHelper = TestUtils.validateNoWarnings(cFile, process.cwd(), [
      helperImpl,
    ]);

    expect(withHelper.valid).toBe(false);
    expect(withHelper.message).toContain("unused parameter");
    // Names the failing unit -- otherwise a multi-TU failure is unattributable.
    expect(withHelper.message).toContain("helper.c");
  });
});
