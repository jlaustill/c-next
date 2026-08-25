/**
 * Issue #1219: file-relationship axis.
 *
 * Depth decides which matrix column a fixture occupies, so a wrong answer here
 * silently credits coverage to the wrong cell. These tests pin the cases that
 * distinguish a correct walk from a plausible one: diamonds, cycles, comment
 * prose, and includes that do not resolve.
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import IncludeDepth from "../matrix/IncludeDepth";
import MatrixCell from "../matrix/MatrixCell";

let dir: string;

const write = (name: string, body: string): string => {
  const path = join(dir, name);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, body, "utf-8");
  return path;
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "cnx-matrix-depth-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("IncludeDepth.maxDepth", () => {
  it("reports 0 for a fixture with no includes", () => {
    const entry = write("solo.test.cnx", "u8 x <- 1;\n");
    expect(IncludeDepth.maxDepth(entry)).toBe(0);
  });

  it("reports 1 for a direct include", () => {
    write("helper.cnx", "const u8 ONE <- 1;\n");
    const entry = write(
      "main.test.cnx",
      '#include "helper.cnx"\nu8 x <- ONE;\n',
    );
    expect(IncludeDepth.maxDepth(entry)).toBe(1);
  });

  it("reports 2 for a transitive include", () => {
    write("deep.cnx", "const u8 ONE <- 1;\n");
    write("middle.cnx", '#include "deep.cnx"\n');
    const entry = write("main.test.cnx", '#include "middle.cnx"\n');
    expect(IncludeDepth.maxDepth(entry)).toBe(2);
  });

  it("takes the LONGER path through a diamond, not the first walked", () => {
    // main -> shared (depth 1) and main -> middle -> shared (depth 2).
    // A shared visited-set would mark `shared` seen on the first branch and
    // report 1, hiding a genuine transitive relationship.
    write("shared.cnx", "const u8 ONE <- 1;\n");
    write("middle.cnx", '#include "shared.cnx"\n');
    const entry = write(
      "main.test.cnx",
      '#include "shared.cnx"\n#include "middle.cnx"\n',
    );
    expect(IncludeDepth.maxDepth(entry)).toBe(2);
  });

  it("terminates on a cycle", () => {
    write("a.cnx", '#include "b.cnx"\n');
    write("b.cnx", '#include "a.cnx"\n');
    const entry = write("main.test.cnx", '#include "a.cnx"\n');
    expect(IncludeDepth.maxDepth(entry)).toBe(2);
  });

  it("ignores an include naming a file that does not exist", () => {
    // A real directive, at line start, resolving to nothing. This is what the
    // filesystem check is actually for -- an unresolvable include must not be
    // charged as a hop. Without the check this fixture reports depth 1.
    const entry = write(
      "main.test.cnx",
      '#include "missing.cnx"\nu8 x <- 1;\n',
    );
    expect(IncludeDepth.maxDepth(entry)).toBe(0);
  });

  it.each([
    [
      "prose mentioning a directive",
      "// Tests: #include <file.cnx> becomes <file.h>",
    ],
    ["a commented-out directive", '// #include "helper.cnx"'],
  ])("does not count %s as an include", (_label, line) => {
    // Excluded by IncludeDiscovery itself, which requires nothing but
    // whitespace before the `#`. Pinned here because the matrix would credit a
    // cross-file cell to a fixture that never crosses one.
    write("helper.cnx", "const u8 ONE <- 1;\n");
    write("file.cnx", "const u8 TWO <- 2;\n");
    const entry = write("main.test.cnx", `${line}\nu8 x <- 1;\n`);
    expect(IncludeDepth.maxDepth(entry)).toBe(0);
  });

  it("does not treat another entry fixture as a helper", () => {
    write("other.test.cnx", "u8 y <- 2;\n");
    const entry = write("main.test.cnx", '#include "other.test.cnx"\n');
    expect(IncludeDepth.maxDepth(entry)).toBe(0);
  });

  it("resolves an include through a subdirectory", () => {
    write("lib/sensors.cnx", "const u8 ONE <- 1;\n");
    const entry = write("main.test.cnx", '#include "lib/sensors.cnx"\n');
    expect(IncludeDepth.maxDepth(entry)).toBe(1);
  });

  it("falls back to a search path when the include is not beside the file", () => {
    write("shared/common.cnx", "const u8 ONE <- 1;\n");
    const entry = write("nested/main.test.cnx", "#include <common.cnx>\n");
    expect(IncludeDepth.maxDepth(entry, [join(dir, "shared")])).toBe(1);
  });

  it("ignores non-.cnx includes", () => {
    write("stdint.h", "");
    const entry = write("main.test.cnx", "#include <stdint.h>\nu8 x <- 1;\n");
    expect(IncludeDepth.maxDepth(entry)).toBe(0);
  });
});

describe("MatrixCell.relationshipForDepth", () => {
  it.each([
    [0, "same-file"],
    [1, "imported-direct"],
    [2, "imported-transitive"],
    [5, "imported-transitive"],
  ])("maps depth %i to %s", (depth, expected) => {
    expect(MatrixCell.relationshipForDepth(depth)).toBe(expected);
  });
});
