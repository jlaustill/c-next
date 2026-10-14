/**
 * #1991: the preprocessor runs a string on standard input from
 * `Installation.headerFreeDirectory`, because on stdin cpp searches its
 * working directory first for a quoted `#include` (#1653). A header put there
 * would be found ahead of the include path, so the directory holds the
 * catalog alone.
 */
import { describe, expect, it } from "vitest";
import { basename } from "node:path";

import Installation from "../Installation";
import NodeFileSystem from "../NodeFileSystem";

describe("Installation", () => {
  const fs = NodeFileSystem.instance;

  it("finds the target catalog", () => {
    expect(fs.isFile(Installation.catalog(fs))).toBe(true);
  });

  it("names a directory holding the catalog alone, so no header", () => {
    const dir = Installation.headerFreeDirectory(fs);
    expect(fs.readdir(dir)).toEqual([basename(Installation.catalog(fs))]);
  });
});
