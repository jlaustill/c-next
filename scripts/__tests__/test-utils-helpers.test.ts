/**
 * Unit coverage for the `TestUtils` helpers the harness reads fixture files
 * through.
 *
 * These four describes were written beside `findHelperHeaderDivergence` and
 * outlived it: #1544 removed that guard, because the standalone helper
 * re-transpile it compared against is gone. All four subjects survive, and one
 * of them is load-bearing in a way it was not before.
 *
 * - `helperClosure` is the only input to the #1488 scheduler lock, so its
 *   cycle-termination case guards a hang the corpus can actually reach
 *   (`tests/bugs/issue-1301-cyclic-include-enum-sources/` includes back).
 * - `firstDifference` backs `describeFirstDifference`, which formats every
 *   snapshot mismatch message; `scripts/test-utils.test.ts` defers to these
 *   cases by name rather than repeating them.
 * - `parseGeneratedHeaderPaths` is what #1544 made authoritative: a
 *   dependency's headers are now taken from the entry run's report, with no
 *   second run left to disagree with it.
 */

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import TestUtils from "../test-utils";

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

  it("does not include the entry file itself, which is what stops it locking itself", () => {
    // Self-inclusion is not the point -- a fixture appearing in its own closure
    // would take a lock nothing ever releases it against, and every OTHER
    // fixture would still be free to rewrite the helpers it holds.
    const helper = write("types.cnx", "enum E { A <- 0 }\n");
    const entry = write("a.test.cnx", '#include "types.cnx"\n');

    const closure = TestUtils.helperClosure(entry);

    expect(closure).toEqual([helper]);
    expect(closure).not.toContain(entry);
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

describe("TestUtils.digestFiles", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "digest-files-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("hashes a file that exists", () => {
    const file = join(tempDir, "a.h");
    writeFileSync(file, "contents\n");
    const digests = TestUtils.digestFiles([file]);

    expect(Object.keys(digests)).toEqual([file]);
    expect(digests[file]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("gives different bytes different digests", () => {
    const one = join(tempDir, "one.h");
    const two = join(tempDir, "two.h");
    writeFileSync(one, "void f(const T* t);\n");
    writeFileSync(two, "void f(T* t);\n");
    const digests = TestUtils.digestFiles([one, two]);

    expect(digests[one]).not.toBe(digests[two]);
  });

  it("omits an absent path rather than recording it as empty", () => {
    // "wrote nothing here" and "wrote an empty file" are different claims, and
    // only the second is a disagreement worth failing on.
    const absent = join(tempDir, "never-written.h");
    const empty = join(tempDir, "empty.h");
    writeFileSync(empty, "");

    const digests = TestUtils.digestFiles([absent, empty]);

    expect(absent in digests).toBe(false);
    expect(empty in digests).toBe(true);
  });
});

describe("TestUtils.findDependencyDisagreement", () => {
  it("records the first writer and reports nothing", () => {
    const seen = new Map<string, { fixture: string; digest: string }>();

    const result = TestUtils.findDependencyDisagreement(
      "/t/alpha.test.cnx",
      { "/t/lib.h": "aaa" },
      seen,
    );

    expect(result).toBeNull();
    expect(seen.get("/t/lib.h")).toEqual({
      fixture: "/t/alpha.test.cnx",
      digest: "aaa",
    });
  });

  // The cases below drive the function for BOTH fixtures rather than seeding
  // `seen` by hand. Seeding it presumes the key the implementation uses, which
  // makes the negative control unable to notice a change to that key -- it
  // passed under a faithful key-by-basename mutation until it was written this
  // way.
  it("accepts a second fixture that generated identical bytes", () => {
    const seen = new Map<string, { fixture: string; digest: string }>();
    TestUtils.findDependencyDisagreement(
      "/t/alpha.test.cnx",
      { "/t/lib.h": "aaa" },
      seen,
    );

    const result = TestUtils.findDependencyDisagreement(
      "/t/beta.test.cnx",
      { "/t/lib.h": "aaa" },
      seen,
    );

    expect(result).toBeNull();
  });

  it("names BOTH fixtures when two disagree about one dependency", () => {
    // Reporting only the second is the #1488 shape: the failure lands on
    // whichever the scheduler ran later, which is the one piece of information
    // that does not identify the defect.
    const seen = new Map<string, { fixture: string; digest: string }>();
    TestUtils.findDependencyDisagreement(
      "/t/alpha.test.cnx",
      { "/t/lib.h": "aaa" },
      seen,
    );

    const result = TestUtils.findDependencyDisagreement(
      "/t/beta.test.cnx",
      { "/t/lib.h": "bbb" },
      seen,
    );

    expect(result).toContain("lib.h");
    expect(result).toContain("alpha.test.cnx");
    expect(result).toContain("beta.test.cnx");
  });

  it("does not confuse two dependencies that share a basename", () => {
    // Negative control, and the shape it guards is in this corpus: the two
    // helpers of `issue-1134-basename-include-collision` are `can/config.h`
    // and `uart/config.h` -- different files, same basename, DIFFERENT bytes.
    // Keying by basename is the plausible mistake, because the message this
    // function returns prints `basename(path)`; such an implementation reports
    // a disagreement here and fails a corpus that is entirely correct.
    const seen = new Map<string, { fixture: string; digest: string }>();
    TestUtils.findDependencyDisagreement(
      "/t/alpha.test.cnx",
      { "/t/can/config.h": "aaa" },
      seen,
    );

    const result = TestUtils.findDependencyDisagreement(
      "/t/beta.test.cnx",
      { "/t/uart/config.h": "bbb" },
      seen,
    );

    expect(result).toBeNull();
  });
});
