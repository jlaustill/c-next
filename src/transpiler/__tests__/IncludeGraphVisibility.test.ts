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

    async function bothModes(name: string, text = USES_VENDOR) {
      const path = join(project, "src", name);
      writeFileSync(path, text);
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
        source: text,
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

    // `uart.cnx` owns `Reading`, and the header on the path defines the same
    // type, as the header generated from it does. Read as input, that header
    // is a second definition (E0425). A struct, not an `extern` variable: a C
    // declaration of a variable C-Next defines is not a conflict, and a guard
    // that relied on one would go silent when E0425 stops over-reporting it
    // (#1707).
    const OWNS_READING = `#include <driver/uart.h>

struct Reading {
    i32 raw;
}
`;
    const DEFINES_READING = `#include <stdint.h>
typedef struct Reading { int32_t raw; } Reading;
`;

    it("a header the transpiler generated is not read as input", async () => {
      writeFileSync(
        join(project, "vendor", "driver", "uart.h"),
        `/**\n * Generated by C-Next Transpiler from: uart.cnx\n */\n${DEFINES_READING}`,
      );

      const { files, source } = await bothModes("uart.cnx", OWNS_READING);

      expect(files.errors).toEqual([]);
      expect(source.errors).toEqual([]);
    });

    it("control: the same header, hand-written, is read -- and conflicts", async () => {
      writeFileSync(
        join(project, "vendor", "driver", "uart.h"),
        DEFINES_READING,
      );

      const { files, source } = await bothModes("uart.cnx", OWNS_READING);

      for (const result of [files, source]) {
        expect(result.errors.map((e) => e.message).join("\n")).toMatch(
          /E0425.*'Reading'/,
        );
      }
    });
  });

  describe("an in-memory root's directory is one decision", () => {
    // ADR-010: a quoted include resolves from the file it appears in. Text
    // given a path appears in that path's directory; `workingDir` is the
    // working directory, which resolves a relative path and is all that text
    // with no path has. Discovery (which files enter the run) and E0506
    // (which quoted includes are missing) must both use that one directory:
    // when they disagreed, a missing include read as a foreign header, E0426
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

    it("a sourcePath decides the directory, whatever the workingDir", async () => {
      // `scripts/format-fidelity.ts` passes the repository root as workingDir
      // and a fixture's absolute path as sourcePath.
      const result = await transpile({
        workingDir: join(project, "other"),
        sourcePath: join(project, "proj", "main.cnx"),
      });

      expect(result.errors).toEqual([]);
      expect(result.files[0]?.code).toContain("EColor c = EColor__GREEN;");
    });

    it("a relative sourcePath resolves against the workingDir", async () => {
      const result = await transpile({
        workingDir: join(project, "proj"),
        sourcePath: "main.cnx",
      });

      expect(result.errors).toEqual([]);
      expect(result.files[0]?.code).toContain("EColor c = EColor__GREEN;");
    });

    it("an include missing beside the sourcePath is E0506, not C-Next in the C", async () => {
      const result = await transpile({
        workingDir: join(project, "proj"),
        sourcePath: join(project, "other", "main.cnx"),
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
