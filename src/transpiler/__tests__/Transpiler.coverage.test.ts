/**
 * Additional unit tests for Transpiler coverage
 *
 * These tests focus on code paths not covered by the main test suite:
 * - C++ mode paths
 * - Cache hit/miss scenarios
 * - Debug mode logging
 * - Header parsing edge cases
 * - Error handling branches
 * - IStandaloneTranspiler interface methods
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import Transpiler from "../Transpiler";
import MockFileSystem from "./MockFileSystem";

describe("Transpiler coverage tests", () => {
  let mockFs: MockFileSystem;

  beforeEach(() => {
    mockFs = new MockFileSystem();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // C++ mode tests
  // ==========================================================================

  describe("declared C++ mode (cppRequired: true)", () => {
    it("generates .cpp output when cppRequired is set", async () => {
      mockFs.addFile(
        "/project/src/main.cnx",
        "void test(u32 value) { u32 x <- value; }",
      );

      const transpiler = new Transpiler(
        {
          input: "/project/src/main.cnx",
          outDir: "/project/build",
          cppRequired: true,
          noCache: true,
        },
        mockFs,
      );

      const result = await transpiler.transpile({ kind: "files" });

      expect(result.success).toBe(true);
      // Check output file has .cpp extension
      const writeCalls = mockFs.getWriteLog();
      expect(writeCalls.some((w) => w.path.endsWith(".cpp"))).toBe(true);
    }, 10000); // Extended timeout for ANTLR parser initialization in CI

    it("transpileSource respects cppRequired config", async () => {
      const transpiler = new Transpiler(
        { input: "", cppRequired: true, noCache: true },
        mockFs,
      );

      const result = (
        await transpiler.transpile({
          kind: "source",
          source: "void test(u32 value) { u32 x <- value; }",
        })
      ).files[0];

      expect(result.success).toBe(true);
      // C++ mode generates different output (const T& vs const T*)
      expect(result.code).toBeDefined();
    });

    it("emits .cpp for a typed-enum header in declared C++ mode", async () => {
      // Create a C header with C++ syntax (typed enum)
      mockFs.addFile(
        "/project/include/types.h",
        "enum Status : uint8_t { OK, ERROR };",
      );
      mockFs.addFile(
        "/project/src/main.cnx",
        `
        #include "types.h"
        void main() { }
      `,
      );

      const transpiler = new Transpiler(
        {
          input: "/project/src/main.cnx",
          includeDirs: ["/project/include"],
          outDir: "/project/build",
          noCache: true,
          // #1319: C++ is declared, not discovered from the header below.
          cppRequired: true,
        },
        mockFs,
      );

      const result = await transpiler.transpile({ kind: "files" });

      expect(result.success).toBe(true);
      // Should generate .cpp file since C++ was detected
      const writeCalls = mockFs.getWriteLog();
      expect(writeCalls.some((w) => w.path.endsWith(".cpp"))).toBe(true);
    });

    it("emits .cpp for a .hpp include in declared C++ mode", async () => {
      mockFs.addFile("/project/include/utils.hpp", "int helper();");
      mockFs.addFile(
        "/project/src/main.cnx",
        `
        #include "utils.hpp"
        void main() { }
      `,
      );

      const transpiler = new Transpiler(
        {
          input: "/project/src/main.cnx",
          includeDirs: ["/project/include"],
          outDir: "/project/build",
          noCache: true,
          // #1319: C++ is declared, not discovered from the header below.
          cppRequired: true,
        },
        mockFs,
      );

      const result = await transpiler.transpile({ kind: "files" });

      expect(result.success).toBe(true);
      // .hpp triggers C++ mode
      const writeCalls = mockFs.getWriteLog();
      expect(writeCalls.some((w) => w.path.endsWith(".cpp"))).toBe(true);
    });
  });

  // ==========================================================================
  // Issue #1319: E0507 -- C++ met in a run that did not declare C++.
  //
  // The transpiler used to switch output languages on its own when an included
  // header turned out to be C++. That made the fact discovered, global and
  // settled mid-run all at once, which is what produced #250, #941, #1139,
  // #1425 and -- worst -- #1171, where auto-const inference was gated on it, so
  // an include added to one file changed what was inferred about another.
  // ==========================================================================

  describe("undeclared C++ is rejected (#1319, E0507)", () => {
    const cnx = `
        #include "dep.h"
        void main() { }
      `;

    const runWith = async (
      header: string,
      name: string,
      cppRequired: boolean,
    ) => {
      mockFs.addFile(`/project/include/${name}`, header);
      mockFs.addFile("/project/src/main.cnx", cnx.replace("dep.h", name));
      return new Transpiler(
        {
          input: "/project/src/main.cnx",
          includeDirs: ["/project/include"],
          outDir: "/project/build",
          noCache: true,
          cppRequired,
        },
        mockFs,
      ).transpile({ kind: "files" });
    };

    it("rejects a .hpp include", async () => {
      const result = await runWith("int helper();", "utils.hpp", false);

      expect(result.success).toBe(false);
      expect(result.errors.map((e) => e.message).join("\n")).toContain("E0507");
    });

    it("rejects a .h whose content is C++", async () => {
      const result = await runWith(
        "enum Status : uint8_t { OK, ERR };",
        "types.h",
        false,
      );

      expect(result.success).toBe(false);
      expect(result.errors.map((e) => e.message).join("\n")).toContain("E0507");
    });

    it("names the file and the fix", async () => {
      const result = await runWith("int helper();", "utils.hpp", false);

      // A diagnostic that says only "C++ found" leaves the reader to guess
      // which include did it and what to do, which is most of the work.
      const text = result.errors.map((e) => e.message).join("\n");
      expect(text).toContain("utils.hpp");
      expect(text).toContain("cppRequired");
    });

    it("stays silent on a pure C header", async () => {
      // Negative control for over-enforcement: without it, a check that
      // rejected EVERY header would pass all three assertions above.
      const result = await runWith("typedef int MyInt;", "plain.h", false);

      expect(result.errors.map((e) => e.message).join("\n")).not.toContain(
        "E0507",
      );
    });

    it("stays silent when C++ is declared", async () => {
      // The other direction: the diagnostic must fire on the DECLARATION being
      // absent, not on the C++ being present.
      const result = await runWith("int helper();", "utils.hpp", true);

      expect(result.errors.map((e) => e.message).join("\n")).not.toContain(
        "E0507",
      );
      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // Debug mode tests
  // ==========================================================================

  describe("Debug mode", () => {
    it("logs debug messages when debugMode is true", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      mockFs.addFile("/project/include/types.h", "typedef int MyInt;");
      mockFs.addFile(
        "/project/src/main.cnx",
        `
        #include "types.h"
        void main() { }
      `,
      );

      const transpiler = new Transpiler(
        {
          input: "/project/src/main.cnx",
          includeDirs: ["/project/include"],
          outDir: "/project/build",
          debugMode: true,
          noCache: true,
        },
        mockFs,
      );

      await transpiler.transpile({ kind: "files" });

      // Debug mode should produce console output
      expect(consoleSpy).toHaveBeenCalled();
      const debugCalls = consoleSpy.mock.calls.filter((call) =>
        String(call[0]).includes("[DEBUG]"),
      );
      expect(debugCalls.length).toBeGreaterThan(0);

      consoleSpy.mockRestore();
    });
  });

  // ==========================================================================
  // Header parsing edge cases
  // ==========================================================================

  describe("Header parsing", () => {
    it("parses pure C header without C++ syntax", async () => {
      mockFs.addFile(
        "/project/include/simple.h",
        `
        typedef unsigned char uint8_t;
        struct Point { int x; int y; };
      `,
      );
      mockFs.addFile(
        "/project/src/main.cnx",
        `
        #include "simple.h"
        void main() { }
      `,
      );

      const transpiler = new Transpiler(
        {
          input: "/project/src/main.cnx",
          includeDirs: ["/project/include"],
          outDir: "/project/build",
          noCache: true,
        },
        mockFs,
      );

      const result = await transpiler.transpile({ kind: "files" });

      expect(result.success).toBe(true);
      // Pure C header should result in .c output (not .cpp)
      const writeCalls = mockFs.getWriteLog();
      expect(writeCalls.some((w) => w.path.endsWith(".c"))).toBe(true);
    });

    it("handles header with no symbols", async () => {
      mockFs.addFile("/project/include/empty.h", "// Empty header");
      mockFs.addFile(
        "/project/src/main.cnx",
        `
        #include "empty.h"
        void main() { }
      `,
      );

      const transpiler = new Transpiler(
        {
          input: "/project/src/main.cnx",
          includeDirs: ["/project/include"],
          outDir: "/project/build",
          noCache: true,
        },
        mockFs,
      );

      const result = await transpiler.transpile({ kind: "files" });

      expect(result.success).toBe(true);
    });

    it("handles C++ header with namespace", async () => {
      mockFs.addFile(
        "/project/include/cpp.hpp",
        `
        namespace sensors {
          void init();
        }
      `,
      );
      mockFs.addFile(
        "/project/src/main.cnx",
        `
        #include "cpp.hpp"
        void main() { }
      `,
      );

      const transpiler = new Transpiler(
        {
          input: "/project/src/main.cnx",
          includeDirs: ["/project/include"],
          outDir: "/project/build",
          noCache: true,
          // #1319: a namespace header is C++; the run must declare it.
          cppRequired: true,
        },
        mockFs,
      );

      const result = await transpiler.transpile({ kind: "files" });

      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // Parse-only mode
  // ==========================================================================

  describe("Parse-only mode", () => {
    it("skips code generation in parseOnly mode", async () => {
      mockFs.addFile("/project/src/main.cnx", "void test() { u32 x <- 5; }");

      const transpiler = new Transpiler(
        {
          input: "/project/src/main.cnx",
          outDir: "/project/build",
          parseOnly: true,
          noCache: true,
        },
        mockFs,
      );

      const result = await transpiler.transpile({ kind: "files" });

      expect(result.success).toBe(true);
      // In parse-only mode, no output files should be written
      expect(result.outputFiles).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Result builder methods
  // ==========================================================================

  describe("Result builders", () => {
    it("buildCatchResult handles Error objects", async () => {
      // Create a transpiler that will fail during generation
      const transpiler = new Transpiler({ input: "", noCache: true }, mockFs);

      // Mock an internal failure by transpiling invalid code that passes parsing
      // but fails in a later stage
      const result = (
        await transpiler.transpile({
          kind: "source",
          source: "void test() { unknownType x; }",
        })
      ).files[0];

      // Should handle gracefully
      expect(result).toBeDefined();
      // Note: This may succeed if unknownType becomes a C identifier
    });

    it("buildCatchResult handles non-Error objects", async () => {
      // Use transpileSource with a scenario that might throw
      const transpiler = new Transpiler({ input: "", noCache: true }, mockFs);

      // Test with valid code to ensure normal path works
      const result = (
        await transpiler.transpile({
          kind: "source",
          source: "void main() { }",
        })
      ).files[0];
      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // Symbol conflicts
  // ==========================================================================

  describe("Symbol conflicts", () => {
    it("succeeds with distinct function names", async () => {
      mockFs.addFile(
        "/project/src/main.cnx",
        `
        void foo() { }
        void bar() { }
      `,
      );

      const transpiler = new Transpiler(
        {
          input: "/project/src/main.cnx",
          noCache: true,
        },
        mockFs,
      );

      const result = await transpiler.transpile({ kind: "files" });

      // Should succeed with distinct function names
      expect(result.success).toBe(true);
    });

    it("reports symbol conflicts across included files", async () => {
      // Create two files that define the same symbol
      mockFs.addFile(
        "/project/src/file1.cnx",
        `
        void duplicateFunc() { }
      `,
      );
      mockFs.addFile(
        "/project/src/file2.cnx",
        `
        #include "file1.cnx"
        void duplicateFunc() { }
      `,
      );

      const transpiler = new Transpiler(
        {
          input: "/project/src/file2.cnx",
          includeDirs: ["/project/src"],
          outDir: "/project/build",
          noCache: true,
        },
        mockFs,
      );

      const result = await transpiler.transpile({ kind: "files" });

      // This test exercises the symbol conflict detection path.
      // #1334: a conflict is an ordinary coded error now, not a second channel.
      expect(result).toBeDefined();
      expect(
        result.errors.filter((e) => e.message.includes("E0425")),
      ).not.toHaveLength(0);
    });
  });

  // ==========================================================================
  // File result error handling (lines 331-338)
  // ==========================================================================

  describe("File transpilation errors via run()", () => {
    it("handles transpileSource errors during run()", async () => {
      // Create a file that parses but fails during code generation
      mockFs.addFile(
        "/project/src/bad.cnx",
        `
        void test() {
          u32 x <- 5;
          u32 result <- (x) ? 1 : 0;
        }
      `,
      );

      const transpiler = new Transpiler(
        {
          input: "/project/src/bad.cnx",
          outDir: "/project/build",
          noCache: true,
        },
        mockFs,
      );

      const result = await transpiler.transpile({ kind: "files" });

      // Should fail due to code generation error
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      // Error should include source path
      expect(result.errors[0].sourcePath).toBeDefined();
    });
  });

  // ==========================================================================
  // External array dimension resolution
  // ==========================================================================

  describe("External array dimension resolution", () => {
    it("resolves array dimensions from same-file constants", async () => {
      // Simplified test without cross-file includes (MockFileSystem limitations)
      mockFs.addFile(
        "/project/src/main.cnx",
        `
        const u8 SIZE <- 10;
        u8[SIZE] buffer;
        void main() { buffer[0] <- 1; }
      `,
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
    });
  });

  // ==========================================================================
  // Contribution building in C++ mode
  // ==========================================================================

  describe("buildContribution in C++ mode", () => {
    it("includes modification data when cppMode is true", async () => {
      mockFs.addFile(
        "/project/src/main.cnx",
        `
        scope API {
          public void process(u32 value) {
            u32 x <- value;
          }
        }
      `,
      );

      const transpiler = new Transpiler(
        {
          input: "/project/src/main.cnx",
          outDir: "/project/build",
          cppRequired: true,
          noCache: true,
        },
        mockFs,
      );

      const result = await transpiler.transpile({ kind: "files" });

      expect(result.success).toBe(true);
      // Check that contributions were processed
      expect(result.files[0]).toBeDefined();
    });
  });

  // ==========================================================================
  // Header generation edge cases
  // ==========================================================================

  describe("Header generation", () => {
    it("skips header generation when no exported symbols", async () => {
      // #1161: a top-level function is public (ADR-016), so it would export.
      // Privacy is what `scope` is for — this is a file that truly exports nothing.
      mockFs.addFile(
        "/project/src/internal.cnx",
        "scope Internal { private void helper() { } }",
      );

      const transpiler = new Transpiler(
        {
          input: "/project/src/internal.cnx",
          outDir: "/project/build",
          noCache: true,
        },
        mockFs,
      );

      const result = await transpiler.transpile({ kind: "files" });

      expect(result.success).toBe(true);
      // No header file should be generated
      const writeCalls = mockFs.getWriteLog();
      const headerWrites = writeCalls.filter((w) => w.path.endsWith(".h"));
      expect(headerWrites).toHaveLength(0);
    });

    it("generates header with function parameters marked as const", async () => {
      mockFs.addFile(
        "/project/src/lib.cnx",
        `
        struct Data { u32 value; }
        scope Processor {
          public void process(Data input) {
            u32 x <- input.value;
          }
        }
      `,
      );

      const transpiler = new Transpiler(
        {
          input: "/project/src/lib.cnx",
          outDir: "/project/build",
          cppRequired: true,
          noCache: true,
        },
        mockFs,
      );

      const result = await transpiler.transpile({ kind: "files" });

      expect(result.success).toBe(true);
      // Header should be generated
      // Issue #933: C++ mode generates .hpp extension
      const writeCalls = mockFs.getWriteLog();
      const headerWrites = writeCalls.filter((w) => w.path.endsWith(".hpp"));
      expect(headerWrites).toHaveLength(1);
    });
  });

  // ==========================================================================
  // Target configuration
  // ==========================================================================

  describe("Target configuration", () => {
    it("passes target to code generator", async () => {
      const transpiler = new Transpiler(
        { input: "", target: "esp32", noCache: true },
        mockFs,
      );

      const result = (
        await transpiler.transpile({
          kind: "source",
          source: "void main() { }",
        })
      ).files[0];

      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // Cross-file modifications in C++ mode
  // ==========================================================================

  describe("Cross-file const inference", () => {
    it("handles modification analysis via transpileSource", async () => {
      // Use transpileSource which works better with MockFileSystem
      const transpiler = new Transpiler(
        {
          input: "",
          cppRequired: true,
          noCache: true,
        },
        mockFs,
      );

      // Simpler code that's known to work
      const result = (
        await transpiler.transpile({
          kind: "source",
          source: `
        void modifyValue(u32 value) {
          u32 x <- value + 1;
        }
        void main() {
          modifyValue(42);
        }
      `,
        })
      ).files[0];

      expect(result.success).toBe(true);
      expect(result.code).toContain("modifyValue");
    });
  });

  // ==========================================================================
  // Error handling during header processing
  // ==========================================================================

  describe("Header processing errors", () => {
    it("handles errors during header symbol collection gracefully", async () => {
      // Create a malformed header that might cause parsing issues
      mockFs.addFile("/project/include/broken.h", "@@@ invalid syntax @@@");
      mockFs.addFile(
        "/project/src/main.cnx",
        `
        #include "broken.h"
        void main() { }
      `,
      );

      const transpiler = new Transpiler(
        {
          input: "/project/src/main.cnx",
          includeDirs: ["/project/include"],
          outDir: "/project/build",
          noCache: true,
        },
        mockFs,
      );

      const result = await transpiler.transpile({ kind: "files" });

      // Should complete (possibly with warnings) rather than crash
      expect(result).toBeDefined();
    });
  });

  // ==========================================================================
  // getSymbolTable
  // ==========================================================================

  describe("getSymbolTable", () => {
    it("returns the symbol table instance", () => {
      const transpiler = new Transpiler({ input: "", noCache: true }, mockFs);

      const symbolTable = transpiler.getSymbolTable();

      expect(symbolTable).toBeDefined();
      expect(typeof symbolTable.size).toBe("number");
    });
  });

  // ==========================================================================
  // Cache flush in standalone mode
  // ==========================================================================

  describe("Cache in standalone mode", () => {
    it("flushes cache after transpileSource when enabled", async () => {
      // Create a mock file system with project marker
      mockFs.addFile("/project/cnext.config.json", "{}");

      const transpiler = new Transpiler(
        {
          input: "/project/main.cnx", // Needed for project root detection
          noCache: false, // Enable cache
        },
        mockFs,
      );

      // transpileSource standalone should flush cache
      const result = (
        await transpiler.transpile({
          kind: "source",
          source: "void main() { }",
        })
      ).files[0];

      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // buildContribution C++ paths
  // ==========================================================================

  describe("buildContribution in C++ mode via run()", () => {
    it("includes modification parameters in contribution", async () => {
      mockFs.addFile(
        "/project/src/lib.cnx",
        `
        scope API {
          public void process(u32 value) {
            u32 x <- value;
          }
        }
      `,
      );

      const transpiler = new Transpiler(
        {
          input: "/project/src/lib.cnx",
          outDir: "/project/build",
          cppRequired: true,
          noCache: true,
        },
        mockFs,
      );

      const result = await transpiler.transpile({ kind: "files" });

      expect(result.success).toBe(true);
      // File contribution should exist
      expect(result.files[0]).toBeDefined();
      expect(result.files[0].success).toBe(true);
    });
  });

  // ==========================================================================
  // Analyzer error path
  // ==========================================================================

  describe("Analyzer errors", () => {
    it("returns error result for MISRA violations", async () => {
      const transpiler = new Transpiler({ input: "", noCache: true }, mockFs);

      // Code with MISRA violation - function call in if condition (Rule 13.5)
      // Note: This may or may not trigger depending on analyzer config
      const result = (
        await transpiler.transpile({
          kind: "source",
          source: `
        bool isReady() { return 1 = 1; }
        void test() {
          if (isReady() && isReady()) { }
        }
      `,
        })
      ).files[0];

      // Result should be defined regardless of success/failure
      expect(result).toBeDefined();
      expect(result.sourcePath).toBe("<string>");
    });

    it("returns error result for analyzer errors via transpileSource", async () => {
      const transpiler = new Transpiler({ input: "", noCache: true }, mockFs);

      // Code that triggers initialization analyzer error
      const result = (
        await transpiler.transpile({
          kind: "source",
          source: `
        void test() {
          u32 x;
          u32 y <- x;
        }
      `,
        })
      ).files[0];

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain("E0381");
    });
  });

  // ==========================================================================
  // Cache hit with C++ syntax detection
  // ==========================================================================

  describe("Cache hit with C++ detection", () => {
    it("parses a cached C++-syntax .h with the C++ parser in declared C++ mode", async () => {
      // Create a project marker for caching
      mockFs.addFile("/project/cnext.config.json", "{}");
      // Create a C header with C++ syntax
      mockFs.addFile(
        "/project/include/typed_enum.h",
        "enum Status : uint8_t { OK, ERROR };",
      );
      mockFs.addFile(
        "/project/src/main.cnx",
        `
        #include "typed_enum.h"
        void main() { }
      `,
      );

      // First run populates cache
      const config = {
        input: "/project/src/main.cnx",
        includeDirs: ["/project/include"],
        outDir: "/project/build",
        noCache: false,
        // #1319: C++ is declared, not discovered from the header below.
        cppRequired: true,
      };

      const transpiler1 = new Transpiler(config, mockFs);
      const result1 = await transpiler1.transpile({ kind: "files" });
      expect(result1.success).toBe(true);

      // Second run uses cache but still detects C++
      const transpiler2 = new Transpiler(config, mockFs);
      const result2 = await transpiler2.transpile({ kind: "files" });
      expect(result2.success).toBe(true);
      // Should still generate .cpp output
      const writeCalls = mockFs.getWriteLog();
      expect(writeCalls.some((w) => w.path.endsWith(".cpp"))).toBe(true);
    });

    it("parses a cached .hpp in declared C++ mode", async () => {
      mockFs.addFile("/project/cnext.config.json", "{}");
      mockFs.addFile("/project/include/utils.hpp", "void helper();");
      mockFs.addFile(
        "/project/src/main.cnx",
        `
        #include "utils.hpp"
        void main() { }
      `,
      );

      const config = {
        input: "/project/src/main.cnx",
        includeDirs: ["/project/include"],
        outDir: "/project/build",
        noCache: false,
        // #1319: C++ is declared, not discovered from the header below.
        cppRequired: true,
      };

      // First run
      const transpiler1 = new Transpiler(config, mockFs);
      await transpiler1.transpile({ kind: "files" });

      // Second run - cache hit path for .hpp
      const transpiler2 = new Transpiler(config, mockFs);
      const result2 = await transpiler2.transpile({ kind: "files" });
      expect(result2.success).toBe(true);

      // Should generate .cpp
      const writeCalls = mockFs.getWriteLog();
      expect(writeCalls.some((w) => w.path.endsWith(".cpp"))).toBe(true);
    });
  });

  // ==========================================================================
  // Debug mode for C++ header parsing
  // ==========================================================================

  describe("Debug mode with C++ header", () => {
    it("logs debug message when parsing C++ header", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      mockFs.addFile("/project/include/module.hpp", "namespace NS { }");
      mockFs.addFile(
        "/project/src/main.cnx",
        `
        #include "module.hpp"
        void main() { }
      `,
      );

      const transpiler = new Transpiler(
        {
          input: "/project/src/main.cnx",
          includeDirs: ["/project/include"],
          outDir: "/project/build",
          debugMode: true,
          noCache: true,
          // #1319: C++ is declared, not discovered from the header below.
          cppRequired: true,
        },
        mockFs,
      );

      await transpiler.transpile({ kind: "files" });

      // Should have debug log for C++ header
      const debugCalls = consoleSpy.mock.calls.filter((call) =>
        String(call[0]).includes("[DEBUG]"),
      );
      const cppHeaderLog = debugCalls.find((call) =>
        String(call[0]).includes("Parsing C++ header"),
      );
      expect(cppHeaderLog).toBeDefined();

      consoleSpy.mockRestore();
    });
  });

  // ==========================================================================
  // Cache hit paths for C++ detection
  // ==========================================================================

  describe("Cache hit C++ detection paths", () => {
    it("keeps declared C++ mode across a cache hit for a C++-syntax .h", async () => {
      // Create files with C++ syntax in a C header (typed enum C++14)
      mockFs.addFile("/project/cnext.config.json", "{}");
      mockFs.addFile(
        "/project/include/cpp_in_c.h",
        "enum Status : uint8_t { OK, ERROR }; // C++14 typed enum",
      );
      mockFs.addFile(
        "/project/src/main.cnx",
        `
        #include "cpp_in_c.h"
        void main() { }
      `,
      );

      const config = {
        input: "/project/src/main.cnx",
        includeDirs: ["/project/include"],
        outDir: "/project/build",
        noCache: false, // Enable cache
        // #1319: C++ is declared, not discovered from the header below.
        cppRequired: true,
      };

      // First run - populates cache and detects C++
      const transpiler1 = new Transpiler(config, mockFs);
      const result1 = await transpiler1.transpile({ kind: "files" });
      expect(result1.success).toBe(true);

      // First run should detect C++ and output .cpp
      let writeCalls = mockFs.getWriteLog();
      expect(writeCalls.some((w) => w.path.endsWith(".cpp"))).toBe(true);

      // Clear write log for second run
      mockFs.clearWriteLog();

      // Second run - should use cache AND still detect C++
      // This tests lines 543-547 (CHeader cache hit with C++ detection)
      const transpiler2 = new Transpiler(config, mockFs);
      const result2 = await transpiler2.transpile({ kind: "files" });
      expect(result2.success).toBe(true);

      // Should output .cpp file (C++ detected even from cache)
      writeCalls = mockFs.getWriteLog();
      expect(writeCalls.some((w) => w.path.endsWith(".cpp"))).toBe(true);
    });

    it("keeps declared C++ mode across a cache hit for a .hpp", async () => {
      // Create hpp header
      mockFs.addFile("/project/cnext.config.json", "{}");
      mockFs.addFile("/project/include/utils.hpp", "void helper();");
      mockFs.addFile(
        "/project/src/main.cnx",
        `
        #include "utils.hpp"
        void main() { }
      `,
      );

      const config = {
        input: "/project/src/main.cnx",
        includeDirs: ["/project/include"],
        outDir: "/project/build",
        noCache: false, // Enable cache
        // #1319: C++ is declared, not discovered from the header below.
        cppRequired: true,
      };

      // First run - populates cache
      const transpiler1 = new Transpiler(config, mockFs);
      const result1 = await transpiler1.transpile({ kind: "files" });
      expect(result1.success).toBe(true);

      // First run should detect C++ from .hpp and output .cpp
      let writeCalls = mockFs.getWriteLog();
      expect(writeCalls.some((w) => w.path.endsWith(".cpp"))).toBe(true);

      // Clear write log for second run
      mockFs.clearWriteLog();

      // Second run - should use cache and still set cppDetected from hpp file
      // This tests lines 548-550 (CppHeader cache hit)
      const transpiler2 = new Transpiler(config, mockFs);
      const result2 = await transpiler2.transpile({ kind: "files" });
      expect(result2.success).toBe(true);

      // Should output .cpp file
      writeCalls = mockFs.getWriteLog();
      expect(writeCalls.some((w) => w.path.endsWith(".cpp"))).toBe(true);
    });
  });

  // ==========================================================================
  // C++ entry point discovery
  // ==========================================================================

  describe("C++ entry point discovery", () => {
    it("discovers C-Next files from C++ entry point via header markers", async () => {
      // Create a C-Next source file
      mockFs.addFile(
        "/project/src/led.cnx",
        "scope LED { public void on() { } }",
      );

      // Create the generated header with marker
      mockFs.addFile(
        "/project/src/led.h",
        `/**
 * Generated by C-Next Transpiler from: led.cnx
 * A safer C for embedded systems
 */
void LED_on(void);`,
      );

      // Create a C++ entry point that includes the header
      mockFs.addFile(
        "/project/src/main.cpp",
        `#include "led.h"
int main() { LED_on(); return 0; }`,
      );

      const transpiler = new Transpiler(
        {
          input: "/project/src/main.cpp",
          outDir: "/project/build",
          noCache: true,
        },
        mockFs,
      );

      const result = await transpiler.transpile({ kind: "files" });

      expect(result.success).toBe(true);
      expect(result.filesProcessed).toBe(1);
      expect(result.files[0].sourcePath).toContain("led.cnx");
    });

    it("returns empty result when no C-Next markers found in C++ include tree", async () => {
      // Create a regular C header (no C-Next marker)
      mockFs.addFile(
        "/project/src/utils.h",
        `#ifndef UTILS_H
#define UTILS_H
void helper(void);
#endif`,
      );

      // Create a C++ entry point
      mockFs.addFile(
        "/project/src/main.cpp",
        `#include "utils.h"
int main() { helper(); return 0; }`,
      );

      const transpiler = new Transpiler(
        {
          input: "/project/src/main.cpp",
          outDir: "/project/build",
          noCache: true,
        },
        mockFs,
      );

      const result = await transpiler.transpile({ kind: "files" });

      expect(result.success).toBe(true);
      expect(result.filesProcessed).toBe(0);
    });

    it("reports scanner errors with Error prefix", async () => {
      // Create a header with marker pointing to non-existent .cnx
      mockFs.addFile(
        "/project/src/missing.h",
        `/**
 * Generated by C-Next Transpiler from: missing.cnx
 */
void Missing_func(void);`,
      );

      // Create C++ entry point
      mockFs.addFile(
        "/project/src/main.cpp",
        `#include "missing.h"
int main() { return 0; }`,
      );

      const transpiler = new Transpiler(
        {
          input: "/project/src/main.cpp",
          outDir: "/project/build",
          noCache: true,
        },
        mockFs,
      );

      const result = await transpiler.transpile({ kind: "files" });

      // Should have error about missing .cnx file
      expect(result.warnings.some((w) => w.includes("Error:"))).toBe(true);
      expect(result.warnings.some((w) => w.includes("missing.cnx"))).toBe(true);
    });

    it("discovers multiple C-Next files from C++ entry point", async () => {
      // Create two C-Next source files
      mockFs.addFile(
        "/project/src/led.cnx",
        "scope LED { public void on() { } }",
      );
      mockFs.addFile(
        "/project/src/motor.cnx",
        "scope Motor { public void start() { } }",
      );

      // Create generated headers with markers
      mockFs.addFile(
        "/project/src/led.h",
        `/**
 * Generated by C-Next Transpiler from: led.cnx
 */
void LED_on(void);`,
      );
      mockFs.addFile(
        "/project/src/motor.h",
        `/**
 * Generated by C-Next Transpiler from: motor.cnx
 */
void Motor_start(void);`,
      );

      // Create C++ entry point that includes both
      mockFs.addFile(
        "/project/src/main.cpp",
        `#include "led.h"
#include "motor.h"
int main() { LED_on(); Motor_start(); return 0; }`,
      );

      const transpiler = new Transpiler(
        {
          input: "/project/src/main.cpp",
          outDir: "/project/build",
          noCache: true,
        },
        mockFs,
      );

      const result = await transpiler.transpile({ kind: "files" });

      expect(result.success).toBe(true);
      expect(result.filesProcessed).toBe(2);
    });

    it("handles .c entry point as well as .cpp", async () => {
      mockFs.addFile(
        "/project/src/led.cnx",
        "scope LED { public void on() { } }",
      );
      mockFs.addFile(
        "/project/src/led.h",
        `/**
 * Generated by C-Next Transpiler from: led.cnx
 */
void LED_on(void);`,
      );
      mockFs.addFile(
        "/project/src/main.c",
        `#include "led.h"
int main() { LED_on(); return 0; }`,
      );

      const transpiler = new Transpiler(
        {
          input: "/project/src/main.c",
          outDir: "/project/build",
          noCache: true,
        },
        mockFs,
      );

      const result = await transpiler.transpile({ kind: "files" });

      expect(result.success).toBe(true);
      expect(result.filesProcessed).toBe(1);
    });
  });
});

// =============================================================================
// Integration tests with real filesystem
// =============================================================================

describe("Transpiler coverage integration tests", () => {
  const testDir = join(process.cwd(), "test-transpiler-coverage-tmp");

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  // ==========================================================================
  // Entry point discovery tests
  // ==========================================================================

  it("discovers included files from entry point", async () => {
    // Create a directory with entry point that includes other files
    const srcDir = join(testDir, "src");
    mkdirSync(srcDir, { recursive: true });

    writeFileSync(
      join(srcDir, "main.cnx"),
      '#include "helper.cnx"\nvoid main() { }',
    );
    writeFileSync(join(srcDir, "helper.cnx"), "void helper() { }");

    const transpiler = new Transpiler({
      input: join(srcDir, "main.cnx"),
      outDir: testDir,
      // Without this the generated header lands in process.cwd().
      headerOutDir: testDir,
      noCache: true,
    });

    const result = await transpiler.transpile({ kind: "files" });

    expect(result.success).toBe(true);
    // Should have processed entry point + included file
    expect(result.filesProcessed).toBe(2);
  });

  // ==========================================================================
  // Cache hit C++ detection tests (covers lines 546-550)
  // ==========================================================================

  it("emits .cpp on both runs for a cached C++-syntax .h in declared C++ mode", async () => {
    // Create project structure with C++ syntax in .h file
    writeFileSync(join(testDir, "cnext.config.json"), "{}");

    const includeDir = join(testDir, "include");
    mkdirSync(includeDir, { recursive: true });

    // C header with typed enum (C++14 feature)
    writeFileSync(
      join(includeDir, "types.h"),
      "enum Status : uint8_t { OK = 0, ERROR = 1 };",
    );

    writeFileSync(
      join(testDir, "main.cnx"),
      `
      #include "types.h"
      void main() { }
    `,
    );

    const config = {
      input: join(testDir, "main.cnx"),
      includeDirs: [includeDir],
      outDir: testDir,
      // Without this the generated header lands in process.cwd().
      headerOutDir: testDir,
      noCache: false, // Enable caching
      // #1319: C++ is declared, not discovered from the header below.
      cppRequired: true,
    };

    // First run - populates cache
    const transpiler1 = new Transpiler(config);
    const result1 = await transpiler1.transpile({ kind: "files" });
    expect(result1.success).toBe(true);
    // First run should detect C++ and output .cpp
    expect(result1.outputFiles.some((f) => f.endsWith(".cpp"))).toBe(true);

    // Second run - should use cache and still detect C++ (lines 543-547)
    const transpiler2 = new Transpiler(config);
    const result2 = await transpiler2.transpile({ kind: "files" });
    expect(result2.success).toBe(true);
    // Should still output .cpp from cache hit path
    expect(result2.outputFiles.some((f) => f.endsWith(".cpp"))).toBe(true);
  });

  it("emits .cpp on both runs for a cached .hpp in declared C++ mode", async () => {
    // Create project structure with .hpp file
    writeFileSync(join(testDir, "cnext.config.json"), "{}");

    const includeDir = join(testDir, "include");
    mkdirSync(includeDir, { recursive: true });

    // .hpp file (always C++)
    writeFileSync(join(includeDir, "utils.hpp"), "void cppHelper();");

    writeFileSync(
      join(testDir, "main.cnx"),
      `
      #include "utils.hpp"
      void main() { }
    `,
    );

    const config = {
      input: join(testDir, "main.cnx"),
      includeDirs: [includeDir],
      outDir: testDir,
      // Without this the generated header lands in process.cwd().
      headerOutDir: testDir,
      noCache: false, // Enable caching
      // #1319: C++ is declared, not discovered from the header below.
      cppRequired: true,
    };

    // First run - populates cache
    const transpiler1 = new Transpiler(config);
    const result1 = await transpiler1.transpile({ kind: "files" });
    expect(result1.success).toBe(true);
    expect(result1.outputFiles.some((f) => f.endsWith(".cpp"))).toBe(true);

    // Second run - should use cache and still detect C++ from .hpp (lines 548-550)
    const transpiler2 = new Transpiler(config);
    const result2 = await transpiler2.transpile({ kind: "files" });
    expect(result2.success).toBe(true);
    expect(result2.outputFiles.some((f) => f.endsWith(".cpp"))).toBe(true);
  });

  // #1319: the cache-hit guard. On a warm cache the header is never parsed, so
  // the rejections inside parseHeaderFile/parseCHeader never run -- which is
  // why `tryRestoreFromCache` carries its own check ("Issue #211: Still check
  // for C++ syntax even on cache hit"). Every other E0507 test uses
  // `noCache: true` and therefore cannot reach it: the guard was real,
  // reachable and completely untested, which is a guard you cannot fail.
  const warmThenUndeclared = async (header: string, name: string) => {
    writeFileSync(join(testDir, "cnext.config.json"), "{}");
    const includeDir = join(testDir, "include");
    mkdirSync(includeDir, { recursive: true });
    writeFileSync(join(includeDir, name), header);
    writeFileSync(
      join(testDir, "main.cnx"),
      `\n      #include "${name}"\n      void main() { }\n    `,
    );
    const base = {
      input: join(testDir, "main.cnx"),
      includeDirs: [includeDir],
      outDir: testDir,
      headerOutDir: testDir,
      noCache: false,
    };

    // Warm the cache with C++ declared, so the header parses and is cached.
    const warm = await new Transpiler({
      ...base,
      cppRequired: true,
    }).transpile({ kind: "files" });
    expect(warm.success).toBe(true);

    // Now run again WITHOUT declaring C++. The header is served from cache and
    // never re-parsed, so only the cache-hit guard can catch it.
    return new Transpiler(base).transpile({ kind: "files" });
  };

  it("rejects a cached .hpp when C++ is no longer declared (#1319)", async () => {
    const result = await warmThenUndeclared("void cppHelper();", "utils.hpp");

    expect(result.success).toBe(false);
    expect(result.errors.map((e) => e.message).join("\n")).toContain("E0507");
  });

  it("rejects a cached C++-syntax .h when C++ is no longer declared (#1319)", async () => {
    const result = await warmThenUndeclared(
      "enum Status : uint8_t { OK, ERR };",
      "types.h",
    );

    expect(result.success).toBe(false);
    expect(result.errors.map((e) => e.message).join("\n")).toContain("E0507");
  });

  it("serves a cached pure C header without complaint (#1319)", async () => {
    // Negative control: the cache-hit path must reject only what is actually
    // C++, not everything it finds warm.
    const result = await warmThenUndeclared("typedef int MyInt;", "plain.h");

    expect(result.errors.map((e) => e.message).join("\n")).not.toContain(
      "E0507",
    );
  });

  it("handles multiple C-Next files with dependencies", async () => {
    // Create files with cross-file dependencies
    writeFileSync(
      join(testDir, "types.cnx"),
      `
      enum Status { Idle, Running, Done }
      struct Config { u16 port; u8 flags; }
    `,
    );
    writeFileSync(
      join(testDir, "main.cnx"),
      `
      #include "types.cnx"
      Config cfg <- { port: 8080, flags: 0 };
      Status state <- Status.Idle;
      void main() { state <- Status.Running; }
    `,
    );

    const transpiler = new Transpiler({
      input: join(testDir, "main.cnx"),
      includeDirs: [testDir],
      outDir: testDir,
      // Without this the generated header lands in process.cwd().
      headerOutDir: testDir,
      noCache: true,
    });

    const result = await transpiler.transpile({ kind: "files" });

    expect(result.success).toBe(true);
    expect(result.files).toHaveLength(2);
  });

  it("uses cache on second run when enabled", async () => {
    // Create project with marker for cache
    writeFileSync(join(testDir, "cnext.config.json"), "{}");
    writeFileSync(join(testDir, "types.h"), "typedef int MyInt;");
    writeFileSync(
      join(testDir, "main.cnx"),
      `
      #include "types.h"
      void main() { }
    `,
    );

    const config = {
      input: join(testDir, "main.cnx"),
      includeDirs: [testDir],
      outDir: testDir,
      // Without this the generated header lands in process.cwd().
      headerOutDir: testDir,
      noCache: false, // Enable cache
    };

    // First run - should populate cache
    const transpiler1 = new Transpiler(config);
    const result1 = await transpiler1.transpile({ kind: "files" });
    expect(result1.success).toBe(true);

    // Second run - should use cache
    const transpiler2 = new Transpiler(config);
    const result2 = await transpiler2.transpile({ kind: "files" });
    expect(result2.success).toBe(true);
  });

  it("handles separate header output directory", async () => {
    const srcDir = join(testDir, "src");
    const buildDir = join(testDir, "build");
    const includeDir = join(testDir, "include");

    mkdirSync(srcDir, { recursive: true });

    writeFileSync(
      join(srcDir, "lib.cnx"),
      `
      scope Math {
        public u32 add(u32 a, u32 b) { return a + b; }
      }
    `,
    );

    const transpiler = new Transpiler({
      input: join(srcDir, "lib.cnx"),
      outDir: buildDir,
      headerOutDir: includeDir,
      noCache: true,
    });

    const result = await transpiler.transpile({ kind: "files" });

    expect(result.success).toBe(true);
    // Should generate output files
    expect(result.outputFiles.length).toBeGreaterThan(0);
    // Check that both .c and .h files are in output
    expect(result.outputFiles.some((f) => f.endsWith(".c"))).toBe(true);
    expect(result.outputFiles.some((f) => f.endsWith(".h"))).toBe(true);
  });

  // ==========================================================================
  // Issue #945: getHeaderContent preprocessing tests
  // ==========================================================================

  it("skips preprocessing when preprocess config is false", async () => {
    const srcDir = join(testDir, "src");
    const includeDir = join(testDir, "include");
    mkdirSync(srcDir, { recursive: true });
    mkdirSync(includeDir, { recursive: true });

    // Create a header with conditional that would trigger preprocessing
    writeFileSync(
      join(includeDir, "config.h"),
      `
      #if FEATURE_ENABLED != 0
      void enabled_func(void);
      #endif
      void always_available(void);
    `,
    );

    writeFileSync(
      join(srcDir, "main.cnx"),
      `
      #include "config.h"
      void test() { always_available(); }
    `,
    );

    const transpiler = new Transpiler({
      input: join(srcDir, "main.cnx"),
      includeDirs: [includeDir],
      preprocess: false, // Explicitly disable preprocessing
      // Without these the generated .c/.h land in process.cwd().
      outDir: testDir,
      headerOutDir: testDir,
      noCache: true,
    });

    const result = await transpiler.transpile({ kind: "files" });
    expect(result.success).toBe(true);
  });

  it("handles header without conditional patterns (no preprocessing needed)", async () => {
    const srcDir = join(testDir, "src");
    const includeDir = join(testDir, "include");
    mkdirSync(srcDir, { recursive: true });
    mkdirSync(includeDir, { recursive: true });

    // Create a simple header without #if MACRO patterns
    writeFileSync(
      join(includeDir, "simple.h"),
      `
      #ifndef SIMPLE_H
      #define SIMPLE_H
      void simple_func(void);
      #endif
    `,
    );

    writeFileSync(
      join(srcDir, "main.cnx"),
      `
      #include "simple.h"
      void test() { simple_func(); }
    `,
    );

    const transpiler = new Transpiler({
      input: join(srcDir, "main.cnx"),
      includeDirs: [includeDir],
      // Without these the generated .c/.h land in process.cwd().
      outDir: testDir,
      headerOutDir: testDir,
      noCache: true,
    });

    const result = await transpiler.transpile({ kind: "files" });
    expect(result.success).toBe(true);
  });

  it("preprocesses header with conditional patterns when preprocessor available", async () => {
    const srcDir = join(testDir, "src");
    const includeDir = join(testDir, "include");
    mkdirSync(srcDir, { recursive: true });
    mkdirSync(includeDir, { recursive: true });

    // Create a config header that defines the feature
    writeFileSync(
      join(includeDir, "config.h"),
      `
      #ifndef CONFIG_H
      #define CONFIG_H
      #define MY_FEATURE 1
      #endif
    `,
    );

    // Create a header with #if MACRO != 0 pattern that needs preprocessing
    writeFileSync(
      join(includeDir, "feature.h"),
      `
      #ifndef FEATURE_H
      #define FEATURE_H
      #include "config.h"

      void always_available(void);

      #if MY_FEATURE != 0
      void feature_func(void);
      #endif
      #endif
    `,
    );

    writeFileSync(
      join(srcDir, "main.cnx"),
      `
      #include "feature.h"
      void test() { always_available(); }
    `,
    );

    const transpiler = new Transpiler({
      input: join(srcDir, "main.cnx"),
      includeDirs: [includeDir],
      // Without these the generated .c/.h land in process.cwd().
      outDir: testDir,
      headerOutDir: testDir,
      noCache: true,
    });

    const result = await transpiler.transpile({ kind: "files" });
    expect(result.success).toBe(true);
  });

  it("falls back to raw content when preprocessing fails (invalid include)", async () => {
    const srcDir = join(testDir, "src");
    const includeDir = join(testDir, "include");
    mkdirSync(srcDir, { recursive: true });
    mkdirSync(includeDir, { recursive: true });

    // Create a header that includes a non-existent file (will cause preprocessing to fail)
    writeFileSync(
      join(includeDir, "broken.h"),
      `
      #ifndef BROKEN_H
      #define BROKEN_H
      #include "nonexistent_config.h"

      #if SOME_MACRO != 0
      void some_func(void);
      #endif

      void available_func(void);
      #endif
    `,
    );

    writeFileSync(
      join(srcDir, "main.cnx"),
      `
      #include "broken.h"
      void test() { available_func(); }
    `,
    );

    const transpiler = new Transpiler({
      input: join(srcDir, "main.cnx"),
      includeDirs: [includeDir],
      // Without these the generated .c/.h land in process.cwd().
      outDir: testDir,
      headerOutDir: testDir,
      noCache: true,
    });

    // Should succeed even if preprocessing fails (falls back to raw content)
    const result = await transpiler.transpile({ kind: "files" });
    // The transpiler should still succeed and add a warning
    expect(result.success).toBe(true);
  });

  // ==========================================================================
  // E0602: side effects in sizeof (ADR-023, MISRA C:2012 Rule 13.6)
  //
  // Covered by .cnx fixtures, but those run outside vitest, so the scanner that
  // decides "is there a call in here?" had no unit coverage. Its edge cases are
  // the reason it replaced /[a-zA-Z_]\w*\s*\(/ (S8786), so they are asserted
  // here against the real pipeline rather than a copy of the scan.
  // ==========================================================================

  describe("sizeof side effects (E0602)", () => {
    const transpileSource = async (body: string) => {
      const transpiler = new Transpiler(
        { input: "", noCache: true },
        new MockFileSystem(),
      );
      return await transpiler.transpile({
        kind: "source",
        source: `u32 getValue() {
  return 42;
}

void main() {
  u32 counter <- 1;
  ${body}
}
`,
      });
    };

    it.each([
      ["a direct call", "u32 bad <- sizeof(getValue());"],
      ["a call within an expression", "u32 bad <- sizeof(getValue() + 1);"],
    ])("rejects %s as a sizeof operand", async (_label, body) => {
      const result = await transpileSource(body);

      expect(result.success).toBe(false);
      expect(result.errors.map((error) => error.message).join("\n")).toContain(
        "E0602",
      );
    });

    it.each([
      ["a plain variable", "u32 size <- sizeof(counter);"],
      ["a parenthesized variable", "u32 size <- sizeof((counter));"],
    ])("accepts %s as a sizeof operand", async (_label, body) => {
      const result = await transpileSource(body);

      expect(
        result.errors.map((error) => error.message).join("\n"),
      ).not.toContain("E0602");
      expect(result.success).toBe(true);
    });
  });
});
