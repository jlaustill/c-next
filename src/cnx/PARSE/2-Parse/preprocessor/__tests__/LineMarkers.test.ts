import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import LineMarkers from "../LineMarkers";

describe("LineMarkers.entered (#1844)", () => {
  it("names the files a compile opened from inside the header", () => {
    const content = [
      '# 0 "lib.h"',
      '# 0 "<built-in>"',
      '# 0 "<command-line>"',
      '# 1 "lib.h"',
      '# 1 "impl.h" 1',
      "int impl;",
      '# 2 "lib.h" 2',
      "int lib;",
    ].join("\n");

    expect([...LineMarkers.entered(content, "lib.h")]).toEqual([
      resolve("impl.h"),
    ]);
  });

  it("does not count a header -imacros read before the header's first line", () => {
    const content = [
      '# 0 "lib.h"',
      '# 0 "<built-in>"',
      '# 0 "<command-line>"',
      '# 1 "./prior.h" 1',
      '# 0 "<command-line>" 2',
      '# 1 "lib.h"',
      "int lib;",
    ].join("\n");

    expect(LineMarkers.entered(content, "lib.h").size).toBe(0);
  });

  it("does not count the file that included the header, which it returns to", () => {
    const content = [
      '# 1 "/tmp/w/cnx-include.h"',
      '# 1 "lib.h" 1',
      '# 1 "impl.h" 1',
      "int impl;",
      '# 2 "lib.h" 2',
      "int lib;",
      '# 2 "/tmp/w/cnx-include.h" 2',
    ].join("\n");

    expect([...LineMarkers.entered(content, "lib.h")]).toEqual([
      resolve("impl.h"),
    ]);
  });
});

describe("LineMarkers.byFile (#1844)", () => {
  it("gives each entered file its own lines, and one with none an empty text", () => {
    const content = [
      '# 1 "lib.h"',
      "int a;",
      '# 1 "empty.h" 1',
      '# 1 "impl.h" 1',
      "int impl;",
      '# 3 "lib.h" 2',
      "int b;",
    ].join("\n");

    expect(LineMarkers.byFile(content)).toEqual(
      new Map([
        [resolve("lib.h"), "int a;\nint b;"],
        [resolve("empty.h"), ""],
        [resolve("impl.h"), "int impl;"],
      ]),
    );
  });
});

describe("LineMarkers.ownLinesInPlace (#2096)", () => {
  it("keeps each of the header's own lines on its line, and blanks what the compile dropped", () => {
    const content = [
      '# 0 "lib.h"',
      '# 0 "<built-in>"',
      '# 1 "lib.h"',
      "#define LIVE",
      '# 1 "impl.h" 1',
      "int impl;",
      '# 3 "lib.h" 2',
      "",
      '# 7 "lib.h"',
      "int live(void);",
    ].join("\n");

    expect(LineMarkers.ownLinesInPlace(content, "lib.h")).toBe(
      ["#define LIVE", "", "", "", "", "", "int live(void);"].join("\n"),
    );
  });

  it("is null for a compile that never entered the header", () => {
    expect(
      LineMarkers.ownLinesInPlace('# 1 "other.h"\nint x;', "lib.h"),
    ).toBeNull();
  });
});
