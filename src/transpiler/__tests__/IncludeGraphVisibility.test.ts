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
      const lib = join(project, ".pio", "libdeps", "teensy41", "colors", "src");
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
      const lib = join(project, ".pio", "libdeps", "teensy41", "colors", "src");
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

  describe("a C header named like a C-Next file of the run", () => {
    // A vendor header is not the generated header of a .cnx because they
    // share a basename: `uart.cnx` wrapping `<driver/uart.h>` is the normal
    // ESP-IDF shape. A generated header carries the C-Next marker, and that is
    // what identifies it.
    const VENDOR_UART = `#ifndef DRIVER_UART_H
#define DRIVER_UART_H
#include <stdint.h>
void uart_init(uint32_t baud);
#endif
`;
    const USES_VENDOR = `#include <driver/uart.h>

void setup() {
    uart_init(115200);
}
`;
    let project: string;

    beforeEach(() => {
      project = mkdtempSync(join(tmpdir(), "cnext-1435-hdr-"));
      mkdirSync(join(project, "vendor", "driver"), { recursive: true });
      writeFileSync(join(project, "vendor", "driver", "uart.h"), VENDOR_UART);
      mkdirSync(join(project, "src"));
    });

    afterEach(() => {
      rmSync(project, { recursive: true, force: true });
    });

    async function bothModes(name: string) {
      const path = join(project, "src", name);
      writeFileSync(path, USES_VENDOR);
      const config = {
        includeDirs: [join(project, "vendor")],
        outDir: join(project, "build"),
        noCache: true,
      };
      const files = await new Transpiler({ ...config, input: path }).transpile({
        kind: "files",
      });
      const source = await new Transpiler({ ...config, input: "" }).transpile({
        kind: "source",
        source: USES_VENDOR,
        workingDir: join(project, "src"),
        sourcePath: path,
      });
      return { files, source };
    }

    it("is read as the C header it is, in both modes", async () => {
      const { files, source } = await bothModes("uart.cnx");

      expect(files.errors).toEqual([]);
      expect(source.errors).toEqual([]);
    });

    it("control: the same program under another name", async () => {
      const { files, source } = await bothModes("serial.cnx");

      expect(files.errors).toEqual([]);
      expect(source.errors).toEqual([]);
    });

    it("control: a header the transpiler generated is still not read as input", async () => {
      // The previous run's output for `uart.cnx`, marker and all, found first
      // on the search path. Read as a C header it would declare `setup` a
      // second time.
      writeFileSync(
        join(project, "vendor", "driver", "uart.h"),
        `/**\n * Generated by C-Next Transpiler from: uart.cnx\n */\nvoid setup(void);\n${VENDOR_UART}`,
      );

      const { files, source } = await bothModes("uart.cnx");

      expect(files.errors.map((e) => e.message).join("\n")).not.toMatch(
        /setup/,
      );
      expect(source.errors.map((e) => e.message).join("\n")).not.toMatch(
        /setup/,
      );
    });
  });

  describe("an in-memory root's directory is one decision", () => {
    // ADR-010: a quoted include resolves from the file it appears in. For an
    // in-memory root that is `workingDir` when the caller says so, else the
    // directory of its `sourcePath`. Discovery (which files enter the run)
    // and E0506 (which quoted includes are missing) must both use it: when
    // they disagreed, a missing include read as a foreign header, E0426
    // declined, and C-Next member syntax reached the C output at exit 0.
    const QUOTED = `#include "colors.cnx"

void main() {
    EColor c <- EColor.GREEN;
}
`;
    let project: string;

    beforeEach(() => {
      project = mkdtempSync(join(tmpdir(), "cnext-1435-dir-"));
      mkdirSync(join(project, "proj"));
      mkdirSync(join(project, "other"));
      writeFileSync(join(project, "proj", "colors.cnx"), COLORS);
    });

    afterEach(() => {
      rmSync(project, { recursive: true, force: true });
    });

    function transpile(where: { workingDir?: string; sourcePath?: string }) {
      return new Transpiler({ input: "", noCache: true }).transpile({
        kind: "source",
        source: QUOTED,
        ...where,
      });
    }

    it("a workingDir with no sourcePath resolves quoted includes there", async () => {
      const result = await transpile({ workingDir: join(project, "proj") });

      expect(result.errors).toEqual([]);
      expect(result.files[0]?.code).toContain("EColor c = EColor__GREEN;");
    });

    it("a sourcePath with no workingDir resolves quoted includes beside it", async () => {
      const result = await transpile({
        sourcePath: join(project, "proj", "main.cnx"),
      });

      expect(result.errors).toEqual([]);
      expect(result.files[0]?.code).toContain("EColor c = EColor__GREEN;");
    });

    it("an explicit workingDir is where the include is found", async () => {
      const result = await transpile({
        workingDir: join(project, "proj"),
        sourcePath: join(project, "other", "main.cnx"),
      });

      expect(result.errors).toEqual([]);
      expect(result.files[0]?.code).toContain("EColor c = EColor__GREEN;");
    });

    it("an explicit workingDir is where the include is missed, and E0506 says so", async () => {
      const result = await transpile({
        workingDir: join(project, "other"),
        sourcePath: join(project, "proj", "main.cnx"),
      });

      expect(result.errors.map((e) => e.message).join("\n")).toContain("E0506");
      expect(result.files.map((f) => f.code).join("\n")).not.toContain(
        "EColor.GREEN",
      );
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
