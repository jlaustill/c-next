/**
 * Issue #1719: a source run is anchored where its text lives, not where the
 * process happens to be.
 *
 * The project root, the compile database it names, the base a `.cnx` header's
 * `#include` is measured from and the include guard's base were all decided
 * once, from `config.input`. The editor constructs the class with an empty
 * `input`, so they came from the parent of the process's cwd: the preview's C
 * changed with the cwd, differed from what `cnext` writes for the same file,
 * and never saw the include paths of the project's `compile_commands.json`.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import Transpiler from "../Transpiler";

describe("where a source run is anchored (#1719)", () => {
  let base: string;

  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), "cnext-1719-"));
  });

  afterEach(() => {
    rmSync(base, { recursive: true, force: true });
  });

  /** Run `fn` with the process in `dir`, restoring the cwd however it ends. */
  async function inDir<T>(dir: string, fn: () => Promise<T>): Promise<T> {
    const cwd = process.cwd();
    process.chdir(dir);
    try {
      return await fn();
    } finally {
      process.chdir(cwd);
    }
  }

  describe("a .cnx dependency's #include and the header's guard", () => {
    const MAIN = `#include "drv/colors.cnx"

void main() {
    EColor c <- EColor.GREEN;
}
`;
    const COLORS = `enum EColor { RED, GREEN }

u8 preferred() {
    return 1;
}
`;
    let project: string;

    beforeEach(() => {
      project = join(base, "serve");
      mkdirSync(join(project, "src", "drv"), { recursive: true });
      mkdirSync(join(base, "elsewhere", "deeper"), { recursive: true });
      writeFileSync(join(project, "src", "main.cnx"), MAIN);
      writeFileSync(join(project, "src", "drv", "colors.cnx"), COLORS);
    });

    /** The editor's call: an empty `input`, and the file it has open. */
    function preview(file: string, text: string) {
      return new Transpiler({ input: "", noCache: true }).transpile({
        kind: "source",
        source: text,
        sourcePath: join(project, "src", file),
      });
    }

    it("are the same from any cwd", async () => {
      const outputs: string[] = [];
      for (const cwd of [
        base,
        project,
        join(project, "src"),
        join(base, "elsewhere", "deeper"),
      ]) {
        const main = await inDir(cwd, () => preview("main.cnx", MAIN));
        const colors = await inDir(cwd, () =>
          preview(join("drv", "colors.cnx"), COLORS),
        );
        expect(main.errors).toEqual([]);
        expect(colors.errors).toEqual([]);
        outputs.push(`${main.files[0]?.code}\n${colors.files[0]?.headerCode}`);
      }

      expect(new Set(outputs).size).toBe(1);
      // Eight full transpiles; past vitest's 5 s default when the machine is
      // loaded (it timed out at a load average near 100, and passes alone).
    }, 30_000);

    it("match what the CLI writes for the same file", async () => {
      const cli = await inDir(project, () =>
        new Transpiler({
          input: join(project, "src", "main.cnx"),
          outDir: join(base, "out"),
          noCache: true,
        }).transpile({ kind: "files" }),
      );
      const fromOutside = await inDir(join(base, "elsewhere"), () =>
        preview("main.cnx", MAIN),
      );
      const cliMain = cli.files.find(
        (f) => f.sourcePath === join(project, "src", "main.cnx"),
      );

      expect(cli.errors).toEqual([]);
      expect(cliMain?.code).toContain('#include "drv/colors.h"');
      expect(fromOutside.files[0]?.code).toBe(cliMain?.code);
    });

    // #1719 box 2: "that C matches what `cnext` writes for the same file" --
    // the header and its guard as well as the `.c`, for each file, with and
    // without a project root (the guard's identity is anchored differently in
    // each: #1133). The same file means `cnext <that file>`: with no project
    // root the CLI's own guard for colors.h depends on which entry it was
    // built from, so no single literal CLI value exists to match.
    it.each([
      ["with no project root", false],
      ["with a project root", true],
    ])(
      "give each file the .c, header and guard the CLI writes for it, %s",
      async (_label, withRoot) => {
        if (withRoot) {
          writeFileSync(join(project, "cnext.config.json"), "{}\n");
        }
        for (const [file, text] of [
          ["main.cnx", MAIN],
          [join("drv", "colors.cnx"), COLORS],
        ] as const) {
          const path = join(project, "src", file);
          const cli = await inDir(project, () =>
            new Transpiler({
              input: path,
              outDir: join(base, "out"),
              noCache: true,
            }).transpile({ kind: "files" }),
          );
          const written = cli.files.find((f) => f.sourcePath === path);
          const previewed = await inDir(join(base, "elsewhere"), () =>
            preview(file, text),
          );

          expect(cli.errors).toEqual([]);
          expect(previewed.errors).toEqual([]);
          expect(previewed.files[0]?.code).toBe(written?.code);
          expect(previewed.files[0]?.headerCode).toBe(written?.headerCode);
        }
      },
    );
  });

  describe("the project's compile_commands.json", () => {
    // A library reachable only through the include path the compile database
    // records. The CLI reads the database from the project root; the editor
    // shape found no project root at all, so `<colors.cnx>` resolved nowhere
    // and C-Next member syntax reached the C at exit 0.
    const MAIN = `#include <colors.cnx>

void main() {
    EColor c <- EColor.GREEN;
}
`;
    let project: string;
    let mainPath: string;

    beforeEach(() => {
      project = join(base, "proj");
      const vendor = join(project, "third_party", "colors");
      mkdirSync(join(project, "src"), { recursive: true });
      mkdirSync(vendor, { recursive: true });
      writeFileSync(join(vendor, "colors.cnx"), "enum EColor { RED, GREEN }\n");
      writeFileSync(join(project, "cnext.config.json"), "{}\n");
      writeFileSync(
        join(project, "compile_commands.json"),
        JSON.stringify([
          {
            directory: project,
            file: join(project, "src", "main.c"),
            arguments: ["cc", `-I${vendor}`, "-c", "src/main.c"],
          },
        ]),
      );
      mainPath = join(project, "src", "main.cnx");
      writeFileSync(mainPath, MAIN);
    });

    it("reaches a source run, as it reaches the CLI", async () => {
      const editor = await new Transpiler({
        input: "",
        noCache: true,
      }).transpile({ kind: "source", source: MAIN, sourcePath: mainPath });

      expect(editor.errors).toEqual([]);
      expect(editor.files[0]?.code).toContain("EColor c = EColor__GREEN;");
    });

    it("control: the CLI shape", async () => {
      const cli = await new Transpiler({
        input: mainPath,
        outDir: join(project, "build"),
        noCache: true,
      }).transpile({ kind: "files" });

      expect(cli.errors).toEqual([]);
      expect(cli.files.find((f) => f.sourcePath === mainPath)?.code).toContain(
        "EColor c = EColor__GREEN;",
      );
    });
  });
});
