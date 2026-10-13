/**
 * Issue #1833, owner ruling of 2026-10-13: only a lowercase `.cnx` or
 * `.cnext` is C-Next source. A source spelled in any other case is rejected
 * with E0518 -- at the include that names it, or as the run's input -- and
 * nothing is written. Before the ruling 1.1 Discover lowercased the extension
 * while every output-naming site matched it case-sensitively, so an in-place
 * build wrote generated C over `Colors.CNX` and exited 0.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import Transpiler from "../Transpiler";
import NodeFileSystem from "../../cnx/PARSE/1-Discover/NodeFileSystem";

const COLORS = "enum EColor { RED, GREEN, BLUE }\n";

function mainIncluding(spelling: string): string {
  return `#include "${spelling}"

void main() {
    EColor c <- EColor.GREEN;
}
`;
}

describe("a C-Next extension is lowercase (#1833)", () => {
  let src: string;

  beforeEach(() => {
    src = join(mkdtempSync(join(tmpdir(), "cnext-1833-")), "src");
    mkdirSync(src);
  });

  afterEach(() => {
    rmSync(join(src, ".."), { recursive: true, force: true });
  });

  /** An in-place build: the output directory is the source directory. */
  async function buildInPlace(input: string) {
    return new Transpiler(
      { target: "host", input: join(src, input), outDir: src, noCache: true },
      NodeFileSystem.instance,
    ).transpile({ kind: "files" });
  }

  const codesOf = (errors: readonly { message: string }[]) =>
    errors.map((e) => /E\d{4}/.exec(e.message)?.[0] ?? e.message);

  for (const name of ["Colors.CNX", "Colors.Cnx", "Colors.CNEXT"]) {
    it(`rejects an include of ${name} and writes nothing`, async () => {
      writeFileSync(join(src, name), COLORS);
      writeFileSync(join(src, "main.cnx"), mainIncluding(name));

      const result = await buildInPlace("main.cnx");

      expect(result.success).toBe(false);
      expect(codesOf(result.errors)).toEqual(["E0518"]);
      expect(readFileSync(join(src, name), "utf8")).toBe(COLORS);
      expect(readdirSync(src).sort()).toEqual([name, "main.cnx"].sort());
    });

    it(`rejects ${name} as the run's input and writes nothing`, async () => {
      writeFileSync(join(src, name), COLORS);

      const result = await buildInPlace(name);

      expect(result.success).toBe(false);
      expect(codesOf(result.errors)).toEqual(["E0518"]);
      expect(readFileSync(join(src, name), "utf8")).toBe(COLORS);
      expect(readdirSync(src)).toEqual([name]);
    });
  }

  for (const name of ["Colors.cnx", "Colors.cnext"]) {
    it(`control: ${name} builds Colors.c and Colors.h beside it`, async () => {
      writeFileSync(join(src, name), COLORS);
      writeFileSync(join(src, "main.cnx"), mainIncluding(name));

      const result = await buildInPlace("main.cnx");

      expect(result.errors).toEqual([]);
      expect(readFileSync(join(src, name), "utf8")).toBe(COLORS);
      expect(readdirSync(src).sort()).toEqual(
        ["Colors.c", "Colors.h", name, "main.c", "main.cnx"].sort(),
      );
      expect(readFileSync(join(src, "main.c"), "utf8")).toContain(
        '#include "Colors.h"',
      );
    });
  }
});
