/**
 * Issue #1553: `validateNoWarnings` compiled with only
 * `-I <root>/tests/include`, omitting the directory the C file itself sits in.
 * A generated header including a sibling generated header was therefore not
 * found, and the check failed on a missing file rather than on warnings --
 * so `/* test-no-warnings *\/` could not be used on any multi-file fixture.
 *
 * The compile+link path already passed both include directories. These two
 * answers to "where do this fixture's headers live" disagreed.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import TestUtils from "../test-utils";

describe("TestUtils.validateNoWarnings", () => {
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
});
