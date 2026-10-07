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
});
