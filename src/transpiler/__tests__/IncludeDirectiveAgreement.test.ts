/**
 * #1745: 1.1 Discover and the parser agree on which lines of a `.cnx` file are
 * `#include` directives.
 *
 * Discovery found them with a text scanner that knew nothing about comments.
 * The parser finds them with the grammar's include token, and a comment is a
 * skipped token there. So discovery pulled in a file that a block comment had
 * disabled, and missed one written after a comment on its line.
 *
 * Case (a) lives here, not as a `.cnx` fixture, because the formatter moves a
 * comment that precedes a directive onto a line of its own, and the pre-commit
 * hook formats every staged `.cnx` file, so the shape could not survive a
 * commit. Here its bytes are written exactly.
 *
 * Case (b) is asserted on a run that SUCCEEDS: the commented-out include's
 * type is never used, so the run must discover exactly the entry. The
 * diagnostic half of (b) is the `.cnx` fixtures in
 * `tests/bugs/issue-1745-include-directive-agreement/`.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";

import Transpiler from "../Transpiler";
import NodeFileSystem from "../NodeFileSystem";

const COLORS = "enum EColor {\n    RED,\n    GREEN\n}\n";
const GHOST = "enum EGhost {\n    A,\n    B\n}\n";

const USES_COLOR =
  "i32 main() {\n" +
  "    EColor c <- EColor.GREEN;\n" +
  "    if (c != EColor.GREEN) {\n" +
  "        return 1;\n" +
  "    }\n" +
  "    return 0;\n" +
  "}\n";

const USES_NOTHING = "i32 main() {\n    return 0;\n}\n";

describe("1.1 Discover and the parser agree on a file's includes (#1745)", () => {
  let project: string;

  beforeEach(() => {
    project = mkdtempSync(join(tmpdir(), "cnext-1745-"));
  });

  afterEach(() => {
    rmSync(project, { recursive: true, force: true });
  });

  /** Transpile `main.cnx`, holding `source`, beside the given helpers. */
  async function transpileMain(
    source: string,
    helpers: Record<string, string>,
  ) {
    for (const [name, text] of Object.entries(helpers)) {
      writeFileSync(join(project, name), text);
    }
    const main = join(project, "main.cnx");
    writeFileSync(main, source);
    return new Transpiler(
      {
        target: "host",
        input: main,
        outDir: join(project, "build"),
        noCache: true,
      },
      NodeFileSystem.instance,
    ).transpile({ kind: "files" });
  }

  /** The source files the run discovered, by name. */
  function discovered(result: Awaited<ReturnType<typeof transpileMain>>) {
    return result.files.map((f) => basename(f.sourcePath)).sort();
  }

  /** Compile every generated `.c` against the generated headers, -Werror. */
  function compiles(result: Awaited<ReturnType<typeof transpileMain>>): void {
    const out = join(project, "compiled");
    mkdirSync(out);
    for (const file of result.files) {
      const stem = basename(file.sourcePath).replace(/\.cnx$/, "");
      writeFileSync(join(out, `${stem}.c`), file.code);
      writeFileSync(join(out, `${stem}.h`), file.headerCode ?? "");
    }
    for (const file of result.files) {
      const stem = basename(file.sourcePath).replace(/\.cnx$/, "");
      execFileSync("gcc", [
        "-std=c99",
        "-Werror",
        "-c",
        "-I",
        out,
        join(out, `${stem}.c`),
        "-o",
        join(out, `${stem}.o`),
      ]);
    }
  }

  describe("(a) a directive after a comment on its line", () => {
    it("is discovered, and the program compiles", async () => {
      const result = await transpileMain(
        `/* driver */ #include "colors.cnx"\n\n${USES_COLOR}`,
        { "colors.cnx": COLORS },
      );

      expect(result.errors).toEqual([]);
      expect(discovered(result)).toEqual(["colors.cnx", "main.cnx"]);
      expect(() => compiles(result)).not.toThrow();
    });

    it("control: the same directive on its own line", async () => {
      const result = await transpileMain(
        `/* driver */\n#include "colors.cnx"\n\n${USES_COLOR}`,
        { "colors.cnx": COLORS },
      );

      expect(result.errors).toEqual([]);
      expect(discovered(result)).toEqual(["colors.cnx", "main.cnx"]);
      expect(() => compiles(result)).not.toThrow();
    });
  });

  describe("(b) an include inside a block comment", () => {
    it("pulls nothing into the run", async () => {
      const result = await transpileMain(
        `/*\n#include "ghost.cnx"\n*/\n\n${USES_NOTHING}`,
        { "ghost.cnx": GHOST },
      );

      expect(result.errors).toEqual([]);
      expect(discovered(result)).toEqual(["main.cnx"]);
    });

    it("control: the same include as a directive is discovered", async () => {
      const result = await transpileMain(
        `#include "ghost.cnx"\n\n${USES_NOTHING}`,
        { "ghost.cnx": GHOST },
      );

      expect(result.errors).toEqual([]);
      expect(discovered(result)).toEqual(["ghost.cnx", "main.cnx"]);
    });
  });
});
