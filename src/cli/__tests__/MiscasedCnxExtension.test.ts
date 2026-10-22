/**
 * Issue #1833, owner ruling of 2026-10-13: only a lowercase `.cnx` is cnx
 * source. A `.cnx` spelled in any other case is rejected with E0518 -- at the
 * include that names it, or as the run's input -- and nothing is written.
 * Before the ruling 1.1 Discover lowercased the extension while every
 * output-naming site matched it case-sensitively, so an in-place build wrote
 * generated C over `Colors.CNX` and exited 0.
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

describe("a cnx extension is a lowercase .cnx (#1833)", () => {
  let src: string;

  beforeEach(() => {
    src = join(mkdtempSync(join(tmpdir(), "cnx-1833-")), "src");
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
    errors.map((e) => /^error\[(E\d{4})\]/.exec(e.message)?.[1] ?? e.message);

  for (const [name, code] of [
    ["Colors.CNX", "E0518"],
    ["Colors.Cnx", "E0518"],
  ] as const) {
    it(`rejects an include of ${name} and writes nothing`, async () => {
      writeFileSync(join(src, name), COLORS);
      writeFileSync(join(src, "main.cnx"), mainIncluding(name));

      const result = await buildInPlace("main.cnx");

      expect(result.success).toBe(false);
      expect(codesOf(result.errors)).toEqual([code]);
      expect(readFileSync(join(src, name), "utf8")).toBe(COLORS);
      expect(readdirSync(src).sort()).toEqual([name, "main.cnx"].sort());
    });

    it(`rejects ${name} as the run's input and writes nothing`, async () => {
      writeFileSync(join(src, name), COLORS);

      const result = await buildInPlace(name);

      expect(result.success).toBe(false);
      expect(codesOf(result.errors)).toEqual([code]);
      // No line names the input: `1:0`, as every run diagnostic (#1847).
      expect(result.errors[0]).toMatchObject({ line: 1, column: 0 });
      expect(readFileSync(join(src, name), "utf8")).toBe(COLORS);
      expect(readdirSync(src)).toEqual([name]);
    });
  }

  // A source run (the editor's) names its text by a path it never reads.
  async function buildSource(sourcePath?: string) {
    return new Transpiler(
      { target: "host", input: "", outDir: "", noCache: true },
      NodeFileSystem.instance,
    ).transpile({
      kind: "source",
      source: "scope Led {\n    public void blink() { }\n}\n",
      ...(sourcePath === undefined
        ? {}
        : { sourcePath: join(src, sourcePath) }),
    });
  }

  it("rejects a source run's text named Colors.CNX with E0518", async () => {
    const result = await buildSource("Colors.CNX");

    expect(result.success).toBe(false);
    expect(codesOf(result.errors)).toEqual(["E0518"]);
  });

  // Its self-include, which a path with no cnx extension leaves as it was
  // before #1833 (`<string>` itself is #1204).
  for (const [name, selfInclude] of [
    ["Colors.cnx", "Colors.h"],
    ["notes.txt", "notes.txt"],
    [undefined, "<string>"],
  ] as const) {
    it(`control: a source run's text named ${name ?? "nothing"} includes ${selfInclude}`, async () => {
      const result = await buildSource(name);

      expect(result.errors).toEqual([]);
      expect(result.files[0].headerCode).toContain("blink");
      expect(result.files[0].code).toContain(`#include "${selfInclude}"`);
    });
  }

  for (const name of ["Colors.cnx"]) {
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
