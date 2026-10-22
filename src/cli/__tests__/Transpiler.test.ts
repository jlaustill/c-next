/**
 * Unit tests for Transpiler
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import Transpiler from "../Transpiler";
import MockFileSystem from "./MockFileSystem";
import ErrorLocation from "../../cnx/utils/ErrorLocation";
import NodeFileSystem from "../../cnx/PARSE/1-Discover/NodeFileSystem";

describe("Transpiler", () => {
  describe("with MockFileSystem", () => {
    let mockFs: MockFileSystem;

    beforeEach(() => {
      mockFs = new MockFileSystem();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    describe("transpile source mode (primary unit testing target)", () => {
      // transpile({ kind: 'source' }) is the main API that benefits from MockFileSystem
      // because it doesn't rely on FileDiscovery for the main code path

      it("transpiles source string without file I/O", async () => {
        const transpiler = new Transpiler(
          { input: "", outDir: "", noCache: true, target: "host" },
          mockFs,
        );

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
        const transpiler = new Transpiler(
          { input: "", outDir: "", noCache: true, target: "host" },
          mockFs,
        );

        const result = await transpiler.transpile({
          kind: "source",
          source: "@@@invalid",
        });

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it("generates header code for exported functions", async () => {
        const transpiler = new Transpiler(
          { input: "", outDir: "", noCache: true, target: "host" },
          mockFs,
        );

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
        const transpiler = new Transpiler(
          { input: "", outDir: "", noCache: true, target: "host" },
          mockFs,
        );

        const result = (
          await transpiler.transpile({
            kind: "source",
            // #1161: top-level functions are public (ADR-016); a scope with
            // only private members is what exports nothing.
            source: "scope Internal { private void helper() { } }",
          })
        ).files[0];

        expect(result.success).toBe(true);
        expect(result.headerCode).toBeUndefined();
      });

      it("respects parseOnly mode", async () => {
        const transpiler = new Transpiler(
          {
            input: "",
            outDir: "",
            parseOnly: true,
            noCache: true,
            target: "host",
          },
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

      it("rejects a write to an undefined name, and reports rather than throws", async () => {
        const transpiler = new Transpiler(
          { input: "", outDir: "", noCache: true, target: "host" },
          mockFs,
        );

        const result = (
          await transpiler.transpile({
            kind: "source",
            source: "void test() { undefinedVar <- 5; }",
          })
        ).files[0];

        // #1582: this asserted `success === true`, with the comment "undefined
        // vars become C identifiers". That was the defect written down as an
        // expectation -- the name reached the generated C unresolved and the C
        // compiler was the only thing that caught it, which inverts what
        // cnx is for. E0427 covered the read position and not the write.
        //
        // What the case is actually here to pin is unchanged: a semantically
        // invalid source is REPORTED, as a structured result, rather than
        // thrown out of the transpiler.
        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].message).toContain("E0427");
        expect(result.errors[0].message).toContain("undefinedVar");
      });

      it("reports narrowing error at the correct line", async () => {
        const transpiler = new Transpiler(
          { input: "", outDir: "", noCache: true, target: "host" },
          mockFs,
        );

        const result = (
          await transpiler.transpile({
            kind: "source",
            source: `void test() {\n  u32 large <- 1000;\n  u8 small <- large;\n}`,
          })
        ).files[0];

        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].line).toBe(3);
        // #1322: column 14 is `large`, the VALUE being narrowed. This used to
        // assert column 2 -- the declaration's first character -- because the
        // position was smuggled through the message by a rethrow wrapper that
        // only knew where the statement began. E0869 in pass 2.1 points at
        // the operand the message is about.
        expect(result.errors[0].column).toBe(14);
        expect(result.errors[0].message).toContain("E0869");
        expect(result.errors[0].message).toContain("narrowing");
      });

      it("defaults to line 1 for errors without location info", () => {
        // #1322: this used to prove the fallback by transpiling
        // `u32 r <- (x) ? 1 : 0;` and asserting the result came back at 1:0.
        // That worked because ADR-022's controlling-expression rule threw from
        // codegen with no position -- so the test was pinned to the DEFECT this
        // card removes, and it broke the moment the rule moved to pass 2.1 and
        // gained a real one.
        //
        // The fallback itself is still real: 98 throws in `output/` have no
        // position yet. It is asserted directly now, against the parser that
        // implements it, so it neither depends on which diagnostic happens to
        // lack a position nor has to be rewritten each time one gains one.
        // When the last throw is relocated this becomes dead and goes with it.
        for (const message of [
          "Code generation failed: something went wrong",
          "no colon at all",
          "notANumber:0 still not a location",
          "12:notANumber also not one",
        ]) {
          const parsed = ErrorLocation.parse(message);
          expect(parsed.line).toBe(1);
          expect(parsed.column).toBe(0);
          expect(parsed.message).toBe(message);
        }
      });

      it("reads a location the message DOES carry", () => {
        // The other half, without which the case above passes for a parser
        // that always returns 1:0.
        const parsed = ErrorLocation.parse("12:4 something failed");
        expect(parsed.line).toBe(12);
        expect(parsed.column).toBe(4);
      });

      it("transpiles various cnx types correctly", async () => {
        const transpiler = new Transpiler(
          { input: "", outDir: "", noCache: true, target: "host" },
          mockFs,
        );

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
        const transpiler = new Transpiler(
          { input: "", outDir: "", noCache: true, target: "host" },
          mockFs,
        );

        const result = (
          await transpiler.transpile({
            kind: "source",
            source: `
          void test() {
            mut u32 x;
            x <- 42;
          }
        `,
          })
        ).files[0];

        expect(result.success).toBe(true);
        expect(result.code).toContain("x = 42");
      });

      it("handles equality operator correctly", async () => {
        const transpiler = new Transpiler(
          { input: "", outDir: "", noCache: true, target: "host" },
          mockFs,
        );

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
        const transpiler = new Transpiler(
          { input: "", outDir: "", noCache: true, target: "host" },
          mockFs,
        );

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
        // #1164: the definition is emitted once, in the header, and the .c
        // includes it. It used to be emitted in both.
        expect(result.headerCode).toContain("typedef struct");
        expect(result.headerCode).toContain("int32_t x");
        expect(result.headerCode).toContain("int32_t y");
        expect(result.code).not.toContain("typedef struct");
      });

      it("generates enum definitions", async () => {
        const transpiler = new Transpiler(
          { input: "", outDir: "", noCache: true, target: "host" },
          mockFs,
        );

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
        // #1164: emitted once, in the header, and included by the .c.
        expect(result.headerCode).toContain("typedef enum");
        expect(result.headerCode).toContain("Color__RED");
        expect(result.headerCode).toContain("Color__GREEN");
        expect(result.headerCode).toContain("Color__BLUE");
        expect(result.code).not.toContain("typedef enum");
      });

      it("handles scope definitions", async () => {
        const transpiler = new Transpiler(
          { input: "", outDir: "", noCache: true, target: "host" },
          mockFs,
        );

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
            target: "host",
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

      // #2086: where output goes is the caller's decision, and whether a file
      // is written is decided by the run, never by outDir's value.
      it("writes both the .c and the .h into the outDir it was given (#2086)", async () => {
        mockFs.addFile(
          "/project/src/main.cnx",
          "scope Led { public u8 level() { return 3; } }",
        );

        const transpiler = new Transpiler(
          {
            input: "/project/src/main.cnx",
            outDir: "/project/build",
            noCache: true,
            target: "host",
          },
          mockFs,
        );

        const result = await transpiler.transpile({ kind: "files" });

        expect(result.success).toBe(true);
        expect(mockFs.getWrittenContent("/project/build/main.c")).toContain(
          "Led__level",
        );
        expect(mockFs.getWrittenContent("/project/build/main.h")).toContain(
          "Led__level",
        );
      });

      it("writes the .c whenever it writes the .h, whatever outDir is (#2086)", async () => {
        mockFs.addFile(
          "/project/src/main.cnx",
          "scope Led { public u8 level() { return 3; } }",
        );

        const transpiler = new Transpiler(
          {
            input: "/project/src/main.cnx",
            outDir: "",
            noCache: true,
            target: "host",
          },
          mockFs,
        );

        const result = await transpiler.transpile({ kind: "files" });

        expect(result.success).toBe(true);
        expect(mockFs.getWriteLog().map((w) => w.path)).toEqual(
          expect.arrayContaining(["main.c", "main.h"]),
        );
        expect(mockFs.getWrittenContent("main.c")).toContain("Led__level");
      });

      it("creates output directory when it does not exist", async () => {
        mockFs.addFile("/project/src/main.cnx", "void main() { }");

        const transpiler = new Transpiler(
          {
            input: "/project/src/main.cnx",
            outDir: "/project/build",
            noCache: true,
            target: "host",
          },
          mockFs,
        );

        await transpiler.transpile({ kind: "files" });

        const mkdirCalls = mockFs.getMkdirLog();
        expect(mkdirCalls.some((c) => c.path === "/project/build")).toBe(true);
      });

      // #2104: "" is the current working directory, like any relative path
      // (".", the control); only a missing headerOutDir falls back to outDir.
      it.each(["", "."])(
        "writes the header relative to the cwd when headerOutDir is %j",
        async (headerOutDir) => {
          mockFs.addFile(
            "/project/src/main.cnx",
            "scope Led { public u8 level() { return 3; } }",
          );

          const transpiler = new Transpiler(
            {
              input: "/project/src/main.cnx",
              outDir: "/project/build",
              headerOutDir,
              noCache: true,
              target: "host",
            },
            mockFs,
          );

          await transpiler.transpile({ kind: "files" });

          expect(mockFs.getWriteLog().map((w) => w.path)).toEqual(
            expect.arrayContaining(["/project/build/main.c", "main.h"]),
          );
          expect(mockFs.getWrittenContent("main.h")).toContain("Led__level");
        },
      );

      // #2104: the same rule for a file outside every input directory, and
      // for the #include that names its header.
      it.each(["", "."])(
        "writes a sideways include's header relative to the cwd when headerOutDir is %j",
        async (headerOutDir) => {
          // With no project root the base is the cwd (#1467); pinned so the
          // file is outside it wherever the suite runs.
          vi.spyOn(process, "cwd").mockReturnValue("/elsewhere");
          mockFs.addFile(
            "/project/src/main.cnx",
            '#include "../lib/util.cnx"\n\nvoid main() { }\n',
          );
          mockFs.addFile(
            "/project/lib/util.cnx",
            "scope Util { public u8 one() { return 1; } }",
          );

          const transpiler = new Transpiler(
            {
              input: "/project/src/main.cnx",
              outDir: "/project/build",
              headerOutDir,
              noCache: true,
              target: "host",
            },
            mockFs,
          );

          await transpiler.transpile({ kind: "files" });

          expect(mockFs.getWriteLog().map((w) => w.path)).toContain("util.h");
          // Spelled from main.c's directory (#2272), so it needs no -I
          expect(mockFs.getWrittenContent("/project/build/main.c")).toContain(
            '#include "../../elsewhere/util.h"',
          );
        },
      );

      it("creates no output directory when the run fails", async () => {
        mockFs.addFile(
          "/project/src/main.cnx",
          "void main() { undeclared <- 1; }",
        );

        const transpiler = new Transpiler(
          {
            input: "/project/src/main.cnx",
            outDir: "/project/build",
            headerOutDir: "/project/include",
            noCache: true,
            target: "host",
          },
          mockFs,
        );

        const result = await transpiler.transpile({ kind: "files" });

        expect(result.success).toBe(false);
        expect(mockFs.getMkdirLog()).toEqual([]);
        expect(mockFs.getWriteLog()).toEqual([]);
      });

      it("writes the header into a separately specified header output directory", async () => {
        mockFs.addFile(
          "/project/src/main.cnx",
          "scope Led { public u8 level() { return 3; } }",
        );

        const transpiler = new Transpiler(
          {
            input: "/project/src/main.cnx",
            outDir: "/project/build",
            headerOutDir: "/project/include",
            noCache: true,
            target: "host",
          },
          mockFs,
        );

        await transpiler.transpile({ kind: "files" });

        expect(mockFs.getWrittenContent("/project/include/main.h")).toContain(
          "Led__level",
        );
        expect(mockFs.getWrittenContent("/project/build/main.c")).toContain(
          "Led__level",
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
            target: "host",
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
            outDir: "/project/build",
            noCache: true,
            target: "host",
          },
          mockFs,
        );

        const result = await transpiler.transpile({ kind: "files" });

        expect(result.filesProcessed).toBe(0);
      });

      it("returns warning when no cnx files found", async () => {
        mockFs.addDirectory("/project/empty");

        const transpiler = new Transpiler(
          {
            input: "/project/empty",
            outDir: "/project/build",
            noCache: true,
            target: "host",
          },
          mockFs,
        );

        const result = await transpiler.transpile({ kind: "files" });

        expect(result.warnings).toContain("No cnx source files found");
      });

      it("handles parse errors gracefully", async () => {
        mockFs.addFile("/project/src/invalid.cnx", "@@@invalid");

        const transpiler = new Transpiler(
          {
            input: "/project/src/invalid.cnx",
            outDir: "/project/build",
            noCache: true,
            target: "host",
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
      // Issue #1133 / #1134: keyed on the basename, can/config.cnx and
      // uart/config.cnx were the same file to include resolution, and their
      // headers both carried CONFIG_H. It reaches code generation, and since
      // #1137 a quoted .cnx include is checked through the injected port, so
      // it runs on MockFileSystem like the collision tests below.
      it("gives same-basename files in different directories distinct guards", async () => {
        mockFs
          .addFile(
            "/project/src/can/config.cnx",
            "scope CanConfig { public u8 bitRate() { return 5; } }",
          )
          .addFile(
            "/project/src/uart/config.cnx",
            "scope UartConfig { public u8 baudRate() { return 9; } }",
          )
          .addFile(
            "/project/src/app.cnx",
            `#include "can/config.cnx"\n#include "uart/config.cnx"\nu32 main() { return 0; }\n`,
          );

        const transpiler = new Transpiler(
          {
            input: "/project/src/app.cnx",
            outDir: "/project/out",
            noCache: true,
            target: "host",
          },
          mockFs,
        );

        const result = await transpiler.transpile({ kind: "files" });

        expect(result.success).toBe(true);
        // Everything it writes stays under its outDir (#1705).
        expect(
          result.outputFiles.filter((p) => !p.startsWith("/project/out/")),
        ).toEqual([]);

        // Both files must reach the compilation (#1134) — before the fix only
        // can/config.* was generated and uart/config.* was silently dropped.
        const headers = result.outputFiles.filter((p) => p.endsWith(".h"));
        expect(headers.length).toBeGreaterThanOrEqual(2);

        // ... and carry distinct guards (#1133).
        const guards = headers.map(
          (p) => /#ifndef (\S+)/.exec(mockFs.readFile(p))?.[1],
        );
        expect(new Set(guards).size).toBe(guards.length);
        for (const guard of guards) {
          expect(guard).toMatch(/^CNX_/);
        }
      });

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
          {
            input: "/project/src/app.cnx",
            outDir: "/project/build",
            noCache: true,
            target: "host",
          },
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
          {
            input: "/project/src/app.cnx",
            outDir: "/project/build",
            noCache: true,
            target: "host",
          },
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

        const transpiler = new Transpiler(
          {
            input: testFile,
            outDir: testDir,
            noCache: true,
            target: "host",
          },
          NodeFileSystem.instance,
        );

        const result = await transpiler.transpile({ kind: "files" });

        expect(result.success).toBe(true);
        expect(result.filesProcessed).toBe(1);
        expect(result.outputFiles.length).toBeGreaterThan(0);
      });

      it("formats parse errors with file path", async () => {
        const testFile = join(testDir, "invalid.cnx");
        writeFileSync(testFile, "void foo( { }");

        const transpiler = new Transpiler(
          {
            input: testFile,
            outDir: testDir,
            noCache: true,
            target: "host",
          },
          NodeFileSystem.instance,
        );

        const result = await transpiler.transpile({ kind: "files" });

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0].sourcePath).toBe(testFile);
      });

      it("includes line and column in parse errors", async () => {
        const testFile = join(testDir, "syntax-error.cnx");
        writeFileSync(testFile, "void foo() {\n  @@@invalid\n}");

        const transpiler = new Transpiler(
          {
            input: testFile,
            outDir: testDir,
            noCache: true,
            target: "host",
          },
          NodeFileSystem.instance,
        );

        const result = await transpiler.transpile({ kind: "files" });

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0].line).toBeGreaterThan(0);
        expect(result.errors[0].column).toBeGreaterThanOrEqual(0);
      });

      it("collects multiple parse errors", async () => {
        const testFile = join(testDir, "multi-error.cnx");
        writeFileSync(testFile, "@@@ $$$ %%%");

        const transpiler = new Transpiler(
          {
            input: testFile,
            outDir: testDir,
            noCache: true,
            target: "host",
          },
          NodeFileSystem.instance,
        );

        const result = await transpiler.transpile({ kind: "files" });

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it("creates output directory if it does not exist", async () => {
        const testFile = join(testDir, "main.cnx");
        const outputDir = join(testDir, "build");
        writeFileSync(testFile, "void main() { }");

        const transpiler = new Transpiler(
          {
            input: testFile,
            outDir: outputDir,
            noCache: true,
            target: "host",
          },
          NodeFileSystem.instance,
        );

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

        const transpiler = new Transpiler(
          {
            input: testFile,
            outDir: testDir,
            noCache: true,
            target: "host",
          },
          NodeFileSystem.instance,
        );

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
      const transpiler = new Transpiler(
        { input: "", outDir: "", noCache: true, target: "host" },
        mockFs,
      );

      const result = await transpiler.transpile({
        kind: "source",
        source: "void main() { }",
      });
      expect(result.success).toBe(true);
      expect(result.files).toHaveLength(1);
      expect(result.files[0].code).toContain("int main");
    });

    it("transpile({ kind: 'source' }) returns header in files[0].headerCode", async () => {
      const transpiler = new Transpiler(
        { input: "", outDir: "", noCache: true, target: "host" },
        mockFs,
      );

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
      const transpiler = new Transpiler(
        { input: "", outDir: "", noCache: true, target: "host" },
        mockFs,
      );

      const result = await transpiler.transpile({
        kind: "source",
        source: "@@@invalid",
      });
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
