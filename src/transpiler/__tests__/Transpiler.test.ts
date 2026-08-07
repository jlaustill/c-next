/**
 * Unit tests for Transpiler
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Transpiler from "../Transpiler";
import MockFileSystem from "./MockFileSystem";

describe("Transpiler", () => {
  describe("with MockFileSystem", () => {
    let mockFs: MockFileSystem;

    beforeEach(() => {
      mockFs = new MockFileSystem();
    });

    describe("transpile source mode (primary unit testing target)", () => {
      // transpile({ kind: 'source' }) is the main API that benefits from MockFileSystem
      // because it doesn't rely on FileDiscovery for the main code path

      it("transpiles source string without file I/O", async () => {
        const transpiler = new Transpiler({ input: "", noCache: true }, mockFs);

        const result = (
          await transpiler.transpile({
            kind: "source",
            source: "u32 add(u32 a, u32 b) { return a + b; }",
          })
        ).files[0];

        expect(result.success).toBe(true);
        expect(result.code).toContain("uint32_t");
        expect(result.code).toContain("add");
      });

      it("returns parse errors for invalid source", async () => {
        const transpiler = new Transpiler({ input: "", noCache: true }, mockFs);

        const result = await transpiler.transpile({
          kind: "source",
          source: "@@@invalid",
        });

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it("generates header code for exported functions", async () => {
        const transpiler = new Transpiler({ input: "", noCache: true }, mockFs);

        const result = (
          await transpiler.transpile({
            kind: "source",
            source: `
          scope API {
            public void doSomething() { }
          }
        `,
          })
        ).files[0];

        expect(result.success).toBe(true);
        expect(result.headerCode).toBeDefined();
        expect(result.headerCode).toContain("API__doSomething");
      });

      it("returns undefined headerCode when no exports", async () => {
        const transpiler = new Transpiler({ input: "", noCache: true }, mockFs);

        const result = (
          await transpiler.transpile({
            kind: "source",
            source: "void privateFunc() { }",
          })
        ).files[0];

        expect(result.success).toBe(true);
        expect(result.headerCode).toBeUndefined();
      });

      it("respects parseOnly mode", async () => {
        const transpiler = new Transpiler(
          { input: "", parseOnly: true, noCache: true },
          mockFs,
        );

        const result = (
          await transpiler.transpile({
            kind: "source",
            source: "u32 test() { return 42; }",
          })
        ).files[0];

        expect(result.success).toBe(true);
        expect(result.code).toBe("");
      });

      it("handles code generation errors gracefully", async () => {
        const transpiler = new Transpiler({ input: "", noCache: true }, mockFs);

        // This should parse but might have semantic issues
        const result = (
          await transpiler.transpile({
            kind: "source",
            source: "void test() { undefinedVar <- 5; }",
          })
        ).files[0];

        // Should still succeed (undefined vars become C identifiers)
        expect(result.success).toBe(true);
      });

      it("reports narrowing error at the correct line", async () => {
        const transpiler = new Transpiler({ input: "", noCache: true }, mockFs);

        const result = (
          await transpiler.transpile({
            kind: "source",
            source: `void test() {\n  u32 large <- 1000;\n  u8 small <- large;\n}`,
          })
        ).files[0];

        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].line).toBe(3);
        expect(result.errors[0].column).toBe(2);
        expect(result.errors[0].message).toContain("narrowing");
      });

      it("defaults to line 1 for errors without location info", async () => {
        const transpiler = new Transpiler({ input: "", noCache: true }, mockFs);

        // Ternary with bare variable produces error without line prefix
        const result = (
          await transpiler.transpile({
            kind: "source",
            source: `void test() { u32 x <- 5; u32 r <- (x) ? 1 : 0; }`,
          })
        ).files[0];

        expect(result.success).toBe(false);
        expect(result.errors[0].line).toBe(1);
        expect(result.errors[0].column).toBe(0);
        expect(result.errors[0].message).toContain("Code generation failed");
      });

      it("transpiles various C-Next types correctly", async () => {
        const transpiler = new Transpiler({ input: "", noCache: true }, mockFs);

        const result = (
          await transpiler.transpile({
            kind: "source",
            source: `
          u8 byte <- 255;
          u16 word <- 65535;
          u32 dword <- 0xFFFFFFFF;
          i8 sbyte <- -128;
          i16 sword <- -32768;
          i32 sdword <- -1;
          f32 floatVal <- 3.14;
          f64 doubleVal <- 2.718;
        `,
          })
        ).files[0];

        expect(result.success).toBe(true);
        expect(result.code).toContain("uint8_t");
        expect(result.code).toContain("uint16_t");
        expect(result.code).toContain("uint32_t");
        expect(result.code).toContain("int8_t");
        expect(result.code).toContain("int16_t");
        expect(result.code).toContain("int32_t");
        expect(result.code).toContain("float");
        expect(result.code).toContain("double");
      });

      it("handles assignment operator correctly", async () => {
        const transpiler = new Transpiler({ input: "", noCache: true }, mockFs);

        const result = (
          await transpiler.transpile({
            kind: "source",
            source: `
          void test() {
            u32 x;
            x <- 42;
          }
        `,
          })
        ).files[0];

        expect(result.success).toBe(true);
        expect(result.code).toContain("x = 42");
      });

      it("handles equality operator correctly", async () => {
        const transpiler = new Transpiler({ input: "", noCache: true }, mockFs);

        const result = (
          await transpiler.transpile({
            kind: "source",
            source: `
          bool test(u32 a, u32 b) {
            return a = b;
          }
        `,
          })
        ).files[0];

        expect(result.success).toBe(true);
        expect(result.code).toContain("a == b");
      });

      it("generates struct definitions", async () => {
        const transpiler = new Transpiler({ input: "", noCache: true }, mockFs);

        const result = (
          await transpiler.transpile({
            kind: "source",
            source: `
          struct Point {
            i32 x;
            i32 y;
          }
        `,
          })
        ).files[0];

        expect(result.success).toBe(true);
        expect(result.code).toContain("typedef struct");
        expect(result.code).toContain("int32_t x");
        expect(result.code).toContain("int32_t y");
      });

      it("generates enum definitions", async () => {
        const transpiler = new Transpiler({ input: "", noCache: true }, mockFs);

        const result = (
          await transpiler.transpile({
            kind: "source",
            source: `
          enum Color {
            RED,
            GREEN,
            BLUE
          }
        `,
          })
        ).files[0];

        expect(result.success).toBe(true);
        expect(result.code).toContain("typedef enum");
        expect(result.code).toContain("Color__RED");
        expect(result.code).toContain("Color__GREEN");
        expect(result.code).toContain("Color__BLUE");
      });

      it("handles scope definitions", async () => {
        const transpiler = new Transpiler({ input: "", noCache: true }, mockFs);

        const result = (
          await transpiler.transpile({
            kind: "source",
            source: `
          scope LED {
            public void on() { }
            public void off() { }
          }
        `,
          })
        ).files[0];

        expect(result.success).toBe(true);
        expect(result.code).toContain("LED__on");
        expect(result.code).toContain("LED__off");
      });
    });

    describe("run() with MockFileSystem", () => {
      it("transpiles a single file", async () => {
        mockFs.addFile(
          "/project/src/main.cnx",
          "u32 getValue() { return 42; }",
        );

        const transpiler = new Transpiler(
          {
            input: "/project/src/main.cnx",
            outDir: "/project/build",
            noCache: true,
          },
          mockFs,
        );

        const result = await transpiler.transpile({ kind: "files" });

        expect(result.success).toBe(true);
        expect(result.filesProcessed).toBe(1);
        expect(result.outputFiles.length).toBeGreaterThan(0);

        // Verify output was written
        const writeCalls = mockFs.getWriteLog();
        expect(writeCalls.some((w) => w.path.endsWith(".c"))).toBe(true);
      });

      it("creates output directory when it does not exist", async () => {
        mockFs.addFile("/project/src/main.cnx", "void main() { }");

        const transpiler = new Transpiler(
          {
            input: "/project/src/main.cnx",
            outDir: "/project/build",
            noCache: true,
          },
          mockFs,
        );

        await transpiler.transpile({ kind: "files" });

        const mkdirCalls = mockFs.getMkdirLog();
        expect(mkdirCalls.some((c) => c.path === "/project/build")).toBe(true);
      });

      it("creates header output directory when specified separately", async () => {
        mockFs.addFile("/project/src/main.cnx", "void main() { }");

        const transpiler = new Transpiler(
          {
            input: "/project/src/main.cnx",
            outDir: "/project/build",
            headerOutDir: "/project/include",
            noCache: true,
          },
          mockFs,
        );

        await transpiler.transpile({ kind: "files" });

        const mkdirCalls = mockFs.getMkdirLog();
        expect(mkdirCalls.some((c) => c.path === "/project/include")).toBe(
          true,
        );
      });

      it("generates header files for exported symbols", async () => {
        mockFs.addFile(
          "/project/src/lib.cnx",
          `
            scope Math {
              public u32 add(u32 a, u32 b) { return a + b; }
            }
          `,
        );

        const transpiler = new Transpiler(
          {
            input: "/project/src/lib.cnx",
            outDir: "/project/build",
            noCache: true,
          },
          mockFs,
        );

        const result = await transpiler.transpile({ kind: "files" });

        expect(result.success).toBe(true);

        const writeCalls = mockFs.getWriteLog();
        const hFile = writeCalls.find((w) => w.path.endsWith(".h"));
        expect(hFile).toBeDefined();
        expect(hFile?.content).toContain("Math__add");
      });

      it("returns no files for non-existent input", async () => {
        const transpiler = new Transpiler(
          {
            input: "/nonexistent/file.cnx",
            noCache: true,
          },
          mockFs,
        );

        const result = await transpiler.transpile({ kind: "files" });

        expect(result.filesProcessed).toBe(0);
      });

      it("returns warning when no C-Next files found", async () => {
        mockFs.addDirectory("/project/empty");

        const transpiler = new Transpiler(
          {
            input: "/project/empty",
            noCache: true,
          },
          mockFs,
        );

        const result = await transpiler.transpile({ kind: "files" });

        expect(result.warnings).toContain("No C-Next source files found");
      });

      it("handles parse errors gracefully", async () => {
        mockFs.addFile("/project/src/invalid.cnx", "@@@invalid");

        const transpiler = new Transpiler(
          {
            input: "/project/src/invalid.cnx",
            noCache: true,
          },
          mockFs,
        );

        const result = await transpiler.transpile({ kind: "files" });

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    // ========================================================================
    // Include guard collisions (ADR-063, issue #1133)
    // ========================================================================

    describe("include guard collisions", () => {
      // NOTE: the positive case (same basename, different directories) lives in
      // the real-file-system block below. It has to reach code generation, and
      // IncludeGenerator validates quote-style .cnx includes through
      // CnxFileResolver.cnxFileExists, which calls existsSync directly instead
      // of the injected IFileSystem. The collision tests here stop at stage 4b,
      // before generation, so MockFileSystem is sufficient for them.

      // Conversion to upper case is lossy, so `-` and `_` collapse together.
      // ADR-063 diagnoses that residue rather than complicating the mapping;
      // the requirement is only that it is never silent.
      it("rejects two files whose paths differ only by a collapsing character", async () => {
        mockFs.addFile(
          "/project/src/mod-a.cnx",
          "scope Alpha { public u8 one() { return 1; } }",
        );
        mockFs.addFile(
          "/project/src/mod_a.cnx",
          "scope Beta { public u8 two() { return 2; } }",
        );
        mockFs.addFile(
          "/project/src/app.cnx",
          `#include "mod-a.cnx"\n#include "mod_a.cnx"\nu32 main() { return 0; }\n`,
        );

        const transpiler = new Transpiler(
          { input: "/project/src/app.cnx", noCache: true },
          mockFs,
        );

        const result = await transpiler.transpile({ kind: "files" });

        expect(result.success).toBe(false);

        const collision = result.errors.find((e) =>
          e.message.includes("E0203"),
        );
        expect(collision).toBeDefined();
        expect(collision?.message).toContain("mod-a.cnx");
        expect(collision?.message).toContain("mod_a.cnx");
        expect(collision?.message).toContain("include guard");
      });

      it("does not emit output when guards collide", async () => {
        mockFs.addFile(
          "/project/src/mod-a.cnx",
          "scope Alpha { public u8 one() { return 1; } }",
        );
        mockFs.addFile(
          "/project/src/mod_a.cnx",
          "scope Beta { public u8 two() { return 2; } }",
        );
        mockFs.addFile(
          "/project/src/app.cnx",
          `#include "mod-a.cnx"\n#include "mod_a.cnx"\nu32 main() { return 0; }\n`,
        );

        const transpiler = new Transpiler(
          { input: "/project/src/app.cnx", noCache: true },
          mockFs,
        );

        const result = await transpiler.transpile({ kind: "files" });

        // The check runs before code generation, so a colliding build produces
        // nothing rather than a set of headers that silently shadow each other.
        expect(result.success).toBe(false);
        expect(result.outputFiles).toHaveLength(0);
      });
    });
  });

  // Integration tests with real file system
  describe("with real file system (integration)", () => {
    const testDir = join(process.cwd(), "test-transpiler-tmp");

    beforeEach(() => {
      mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
      rmSync(testDir, { recursive: true, force: true });
    });

    describe("run()", () => {
      it("transpiles a simple file", async () => {
        const testFile = join(testDir, "simple.cnx");
        writeFileSync(testFile, "u32 getValue() { return 42; }");

        const transpiler = new Transpiler({
          input: testFile,
          outDir: testDir,
          noCache: true,
        });

        const result = await transpiler.transpile({ kind: "files" });

        expect(result.success).toBe(true);
        expect(result.filesProcessed).toBe(1);
        expect(result.outputFiles.length).toBeGreaterThan(0);
      });

      // Issue #1133 / #1134: keyed on the basename, can/config.cnx and
      // uart/config.cnx were the same file to include resolution, and their
      // headers both carried CONFIG_H. Needs the real file system because
      // IncludeGenerator validates quote-style .cnx includes through
      // existsSync rather than the injected IFileSystem.
      it("gives same-basename files in different directories distinct guards", async () => {
        mkdirSync(join(testDir, "can"), { recursive: true });
        mkdirSync(join(testDir, "uart"), { recursive: true });
        writeFileSync(
          join(testDir, "can", "config.cnx"),
          "scope CanConfig { public u8 bitRate() { return 5; } }",
        );
        writeFileSync(
          join(testDir, "uart", "config.cnx"),
          "scope UartConfig { public u8 baudRate() { return 9; } }",
        );
        const entry = join(testDir, "app.cnx");
        writeFileSync(
          entry,
          `#include "can/config.cnx"\n#include "uart/config.cnx"\nu32 main() { return 0; }\n`,
        );

        const transpiler = new Transpiler({ input: entry, noCache: true });

        const result = await transpiler.transpile({ kind: "files" });

        expect(result.success).toBe(true);

        // Both files must reach the compilation (#1134) — before the fix only
        // can/config.* was generated and uart/config.* was silently dropped.
        const headers = result.outputFiles.filter((p) => p.endsWith(".h"));
        expect(headers.length).toBeGreaterThanOrEqual(2);

        // ... and carry distinct guards (#1133).
        const guards = headers.map(
          (p) => /#ifndef (\S+)/.exec(readFileSync(p, "utf-8"))?.[1],
        );
        expect(new Set(guards).size).toBe(guards.length);
        for (const guard of guards) {
          expect(guard).toMatch(/^CNX_/);
        }
      });

      it("formats parse errors with file path", async () => {
        const testFile = join(testDir, "invalid.cnx");
        writeFileSync(testFile, "void foo( { }");

        const transpiler = new Transpiler({
          input: testFile,
          noCache: true,
        });

        const result = await transpiler.transpile({ kind: "files" });

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0].sourcePath).toBe(testFile);
      });

      it("includes line and column in parse errors", async () => {
        const testFile = join(testDir, "syntax-error.cnx");
        writeFileSync(testFile, "void foo() {\n  @@@invalid\n}");

        const transpiler = new Transpiler({
          input: testFile,
          noCache: true,
        });

        const result = await transpiler.transpile({ kind: "files" });

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0].line).toBeGreaterThan(0);
        expect(result.errors[0].column).toBeGreaterThanOrEqual(0);
      });

      it("collects multiple parse errors", async () => {
        const testFile = join(testDir, "multi-error.cnx");
        writeFileSync(testFile, "@@@ $$$ %%%");

        const transpiler = new Transpiler({
          input: testFile,
          noCache: true,
        });

        const result = await transpiler.transpile({ kind: "files" });

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it("creates output directory if it does not exist", async () => {
        const testFile = join(testDir, "main.cnx");
        const outputDir = join(testDir, "build");
        writeFileSync(testFile, "void main() { }");

        const transpiler = new Transpiler({
          input: testFile,
          outDir: outputDir,
          noCache: true,
        });

        const result = await transpiler.transpile({ kind: "files" });

        expect(result.success).toBe(true);
        expect(result.outputFiles.length).toBeGreaterThan(0);
      });

      it("generates header files for exported symbols", async () => {
        const testFile = join(testDir, "lib.cnx");
        writeFileSync(
          testFile,
          `
          scope Math {
            public u32 multiply(u32 a, u32 b) { return a * b; }
          }
        `,
        );

        const transpiler = new Transpiler({
          input: testFile,
          outDir: testDir,
          noCache: true,
        });

        const result = await transpiler.transpile({ kind: "files" });

        expect(result.success).toBe(true);
        // Should have both .c and .h output
        expect(result.outputFiles.some((f) => f.endsWith(".c"))).toBe(true);
        expect(result.outputFiles.some((f) => f.endsWith(".h"))).toBe(true);
      });
    });
  });

  describe("transpile() unified entry point", () => {
    let mockFs: MockFileSystem;

    beforeEach(() => {
      mockFs = new MockFileSystem();
    });

    it("transpile({ kind: 'source' }) returns ITranspilerResult with files[]", async () => {
      const transpiler = new Transpiler({ input: "", noCache: true }, mockFs);

      const result = await transpiler.transpile({
        kind: "source",
        source: "void main() { }",
      });
      expect(result.success).toBe(true);
      expect(result.files).toHaveLength(1);
      expect(result.files[0].code).toContain("int main");
    });

    it("transpile({ kind: 'source' }) returns header in files[0].headerCode", async () => {
      const transpiler = new Transpiler({ input: "", noCache: true }, mockFs);

      const result = await transpiler.transpile({
        kind: "source",
        source: `
          scope API {
            public void doSomething() { }
          }
        `,
      });
      expect(result.success).toBe(true);
      expect(result.files[0].headerCode).toContain("API__doSomething");
    });

    it("transpile({ kind: 'source' }) returns errors in result", async () => {
      const transpiler = new Transpiler({ input: "", noCache: true }, mockFs);

      const result = await transpiler.transpile({
        kind: "source",
        source: "@@@invalid",
      });
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
