/**
 * Issue #1470: the guard that catches a helper's header disagreeing between
 * the entry's multi-file pipeline run and the harness's later single-file
 * re-transpile of that same helper. See TestUtils.findHelperHeaderDivergence.
 */

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import TestUtils from "../test-utils";

describe("TestUtils.findHelperHeaderDivergence", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "helper-header-divergence-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("reports a divergence naming the path when the file changed", () => {
    const headerPath = join(tempDir, "sensors.h");
    writeFileSync(headerPath, "uint8_t Sensors__readValue(Sample* sample);\n");

    const result = TestUtils.findHelperHeaderDivergence(
      [
        {
          path: headerPath,
          content: "uint8_t Sensors__readValue(const Sample* sample);\n",
        },
      ],
      "c",
      tempDir,
    );

    expect(result).not.toBeNull();
    expect(result?.error).toContain("sensors.h");
    expect(result?.error).toContain("issue #1470");
    expect(result?.error).toContain("First difference at line 1");
    expect(result?.expected).toBe(
      "uint8_t Sensors__readValue(const Sample* sample);\n",
    );
    expect(result?.actual).toBe(
      "uint8_t Sensors__readValue(Sample* sample);\n",
    );
  });

  it("returns null when the file still matches what was captured", () => {
    const headerPath = join(tempDir, "sensors.h");
    const content = "uint8_t Sensors__readValue(const Sample* sample);\n";
    writeFileSync(headerPath, content);

    const result = TestUtils.findHelperHeaderDivergence(
      [{ path: headerPath, content }],
      "c",
      tempDir,
    );

    expect(result).toBeNull();
  });

  it("returns null when nothing was captured and the file is still absent", () => {
    const headerPath = join(tempDir, "never-written.h");

    const result = TestUtils.findHelperHeaderDivergence(
      [{ path: headerPath, content: null }],
      "c",
      tempDir,
    );

    expect(result).toBeNull();
  });

  it("reports a divergence when a header appears where none was captured", () => {
    const headerPath = join(tempDir, "surprise.h");
    writeFileSync(headerPath, "void Surprise__init(void);\n");

    const result = TestUtils.findHelperHeaderDivergence(
      [{ path: headerPath, content: null }],
      "c",
      tempDir,
    );

    expect(result).not.toBeNull();
    expect(result?.expected).toBe("<no header emitted>");
    expect(result?.actual).toBe("void Surprise__init(void);\n");
  });

  it("names the file relative to rootDir even with a trailing separator", () => {
    mkdirSync(join(tempDir, "lib"));
    const headerPath = join(tempDir, "lib", "sensors.h");
    writeFileSync(headerPath, "actual\n");

    const result = TestUtils.findHelperHeaderDivergence(
      [{ path: headerPath, content: "expected\n" }],
      "c",
      `${tempDir}/`,
    );

    expect(result?.error).toContain("lib/sensors.h");
  });

  it("checks every captured path, not just the first", () => {
    const unchangedPath = join(tempDir, "unchanged.h");
    const changedPath = join(tempDir, "changed.h");
    writeFileSync(unchangedPath, "same\n");
    writeFileSync(changedPath, "after\n");

    const result = TestUtils.findHelperHeaderDivergence(
      [
        { path: unchangedPath, content: "same\n" },
        { path: changedPath, content: "before\n" },
      ],
      "cpp",
      tempDir,
    );

    expect(result?.error).toContain("changed.h");
    expect(result?.error).toContain("CPP");
  });
});

describe("TestUtils.helperClosure", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "helper-closure-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  const write = (name: string, body: string): string => {
    const full = join(tempDir, name);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
    return full;
  };

  it("is empty for a fixture that includes nothing", () => {
    const entry = write("a.test.cnx", "u32 main() { return 0; }\n");

    expect(TestUtils.helperClosure(entry)).toEqual([]);
  });

  it("finds the direct helper", () => {
    const helper = write("types.cnx", "enum E { A <- 0 }\n");
    const entry = write("a.test.cnx", '#include "types.cnx"\n');

    expect(TestUtils.helperClosure(entry)).toEqual([helper]);
  });

  it("follows helpers of helpers -- the pipeline writes their headers too", () => {
    const deep = write("lib/deep.cnx", "u32 deep() { return 1; }\n");
    const mid = write("lib/mid.cnx", '#include "deep.cnx"\n');
    const entry = write("a.test.cnx", '#include "lib/mid.cnx"\n');

    expect(TestUtils.helperClosure(entry).sort()).toEqual([deep, mid].sort());
  });

  it("terminates on a cycle instead of recursing forever", () => {
    const one = write("one.cnx", '#include "two.cnx"\n');
    const two = write("two.cnx", '#include "one.cnx"\n');
    const entry = write("a.test.cnx", '#include "one.cnx"\n');

    expect(TestUtils.helperClosure(entry).sort()).toEqual([one, two].sort());
  });

  it("ignores an include naming another fixture, which is not a helper", () => {
    write("other.test.cnx", "u32 main() { return 0; }\n");
    const entry = write("a.test.cnx", '#include "other.test.cnx"\n');

    expect(TestUtils.helperClosure(entry)).toEqual([]);
  });

  it("ignores an include with no file on disk", () => {
    const entry = write("a.test.cnx", '#include "absent.cnx"\n');

    expect(TestUtils.helperClosure(entry)).toEqual([]);
  });
});

describe("TestUtils.firstDifference", () => {
  it("returns null for identical text", () => {
    expect(TestUtils.firstDifference("a\nb\nc", "a\nb\nc")).toBeNull();
  });

  it("finds the first differing line, not the first byte", () => {
    const expected = "#ifndef GUARD\n#define GUARD\n\nuint8_t f(const T* t);\n";
    const actual = "#ifndef GUARD\n#define GUARD\n\nuint8_t f(T* t);\n";

    expect(TestUtils.firstDifference(expected, actual)).toEqual({
      line: 4,
      expected: "uint8_t f(const T* t);",
      actual: "uint8_t f(T* t);",
    });
  });

  it("reports a missing trailing line as empty", () => {
    expect(TestUtils.firstDifference("a\nb\n", "a\n")).toEqual({
      line: 2,
      expected: "b",
      actual: "",
    });
  });
});

describe("TestUtils.parseGeneratedHeaderPaths", () => {
  it("returns headers from a multi-file run, excluding impl files", () => {
    const stdout = [
      "Generated 3 output files:",
      "  /root/lib/sensors.c",
      "  /root/entry.test.c",
      "  /root/lib/sensors.h",
      "",
    ].join("\n");

    expect(TestUtils.parseGeneratedHeaderPaths(stdout)).toEqual([
      "/root/lib/sensors.h",
    ]);
  });

  it("returns an empty list when no header was written", () => {
    const stdout = [
      "Generated 1 output file:",
      "  /root/entry.test.c",
      "",
    ].join("\n");

    expect(TestUtils.parseGeneratedHeaderPaths(stdout)).toEqual([]);
  });

  it("returns an empty list when the block is absent", () => {
    expect(TestUtils.parseGeneratedHeaderPaths("Error: boom\n")).toEqual([]);
  });
});

describe("TestUtils.parseGeneratedImplPaths", () => {
  it("still excludes headers now that both share the block parser", () => {
    const stdout = [
      "Generated 2 output files:",
      "  /root/entry.test.c",
      "  /root/entry.test.h",
      "",
    ].join("\n");

    expect(TestUtils.parseGeneratedImplPaths(stdout)).toEqual([
      "/root/entry.test.c",
    ]);
  });
});
