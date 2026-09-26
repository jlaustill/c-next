/**
 * Issue #1435: what a file can SEE is the include graph discovery resolved.
 *
 * Discovery resolves every `.cnx` include with the full search policy (the
 * file's directory, the project tiers, PlatformIO libdeps, Arduino libraries)
 * through the injected `IFileSystem`. Visibility must read that same graph. A
 * second derivation that re-reads files and rebuilds a weaker search path
 * compiles a file and then reports its types as "not defined" to the file that
 * included it.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import Transpiler from "../Transpiler";
import MockFileSystem from "./MockFileSystem";

const COLORS = `enum EColor { RED, GREEN, BLUE }
`;

const MAIN_USES_ENUM = `#include <colors.cnx>

void main() {
    EColor c <- EColor.GREEN;
}
`;

describe("include-graph visibility (Issue #1435)", () => {
  describe("PlatformIO libdeps", () => {
    let project: string;

    beforeEach(() => {
      project = mkdtempSync(join(tmpdir(), "cnext-1435-"));
      writeFileSync(
        join(project, "platformio.ini"),
        "[env:teensy41]\nplatform = teensy\n",
      );
      mkdirSync(join(project, "src"));
    });

    afterEach(() => {
      rmSync(project, { recursive: true, force: true });
    });

    async function transpileMain() {
      const mainPath = join(project, "src", "main.cnx");
      writeFileSync(mainPath, MAIN_USES_ENUM);
      // An explicit outDir: without one the run writes into the cwd (#1705).
      const result = await new Transpiler({
        input: mainPath,
        outDir: join(project, "build"),
        noCache: true,
      }).transpile({ kind: "files" });
      return {
        result,
        main: result.files.find((f) => f.sourcePath === mainPath),
      };
    }

    it("an enum declared in a .pio/libdeps include is visible to the includer", async () => {
      const lib = join(
        project,
        ".pio",
        "libdeps",
        "teensy41",
        "colorlib",
        "src",
      );
      mkdirSync(lib, { recursive: true });
      writeFileSync(join(lib, "colors.cnx"), COLORS);

      const { result, main } = await transpileMain();

      expect(result.errors).toEqual([]);
      expect(main?.code).toContain("EColor c = EColor__GREEN;");
    });

    it("control: the same include beside the includer", async () => {
      writeFileSync(join(project, "src", "colors.cnx"), COLORS);

      const { result, main } = await transpileMain();

      expect(result.errors).toEqual([]);
      expect(main?.code).toContain("EColor c = EColor__GREEN;");
    });

    it("an in-memory root resolves a .pio/libdeps include as its file on disk does", async () => {
      const lib = join(
        project,
        ".pio",
        "libdeps",
        "teensy41",
        "colorlib",
        "src",
      );
      mkdirSync(lib, { recursive: true });
      writeFileSync(join(lib, "colors.cnx"), COLORS);
      const mainPath = join(project, "src", "main.cnx");

      // Exactly how `ServeCommand` (the editor preview) calls it.
      const result = await new Transpiler({
        input: "",
        noCache: true,
      }).transpile({
        kind: "source",
        source: MAIN_USES_ENUM,
        workingDir: join(project, "src"),
        sourcePath: mainPath,
      });

      expect(result.errors).toEqual([]);
      expect(
        result.files.find((f) => f.sourcePath === mainPath)?.code,
      ).toContain("EColor c = EColor__GREEN;");
    });
  });

  describe("an injected IFileSystem", () => {
    let fs: MockFileSystem;

    beforeEach(() => {
      fs = new MockFileSystem();
      fs.addFile("/vfs/src/colors.cnx", COLORS);
    });

    async function transpile(main: string) {
      fs.addFile("/vfs/src/main.cnx", main);
      const result = await new Transpiler(
        { input: "/vfs/src/main.cnx", outDir: "/vfs/build", noCache: true },
        fs,
      ).transpile({ kind: "files" });
      return {
        result,
        main: result.files.find((f) => f.sourcePath === "/vfs/src/main.cnx"),
      };
    }

    it("an enum from a nested include is visible when no file is on disk", async () => {
      const { result, main } = await transpile(MAIN_USES_ENUM);

      expect(result.errors).toEqual([]);
      expect(main?.code).toContain("EColor c = EColor__GREEN;");
    });

    it("control: discovery itself reads the injected filesystem", async () => {
      const { result } = await transpile(`#include <colors.cnx>

void main() {
}
`);

      expect(result.errors).toEqual([]);
      expect(result.files.map((f) => f.sourcePath).sort()).toEqual([
        "/vfs/src/colors.cnx",
        "/vfs/src/main.cnx",
      ]);
    });
  });
});
