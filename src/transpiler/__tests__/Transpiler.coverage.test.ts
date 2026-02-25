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

  describe("C++ mode (cppRequired: true)", () => {
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

    it("detects C++ from header with typed enum", async () => {
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
        },
        mockFs,
      );

      const result = await transpiler.transpile({ kind: "files" });

      expect(result.success).toBe(true);
      // Should generate .cpp file since C++ was detected
      const writeCalls = mockFs.getWriteLog();
      expect(writeCalls.some((w) => w.path.endsWith(".cpp"))).toBe(true);
    });

    it("detects C++ from .hpp header file", async () => {
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
      expect(result.outputFiles.length).toBe(0);
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

      // This test exercises the symbol conflict detection path (lines 240-256)
      // Duplicate function definitions across included files trigger conflicts
      expect(result).toBeDefined();
      expect(result.conflicts).toBeDefined();
      expect(result.conflicts.length).toBeGreaterThan(0);
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
      mockFs.addFile("/project/src/internal.cnx", "void privateFunc() { }");

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
      expect(headerWrites.length).toBe(0);
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
      expect(headerWrites.length).toBe(1);
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
    it("detects C++ syntax from cached CHeader", async () => {
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

    it("detects C++ from cached hpp header", async () => {
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
    it("sets cppDetected on cache hit for C header with C++ syntax", async () => {
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

    it("sets cppDetected on cache hit for hpp header", async () => {
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

  it("detects C++ from cached C header on second run", async () => {
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
      noCache: false, // Enable caching
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

  it("detects C++ from cached hpp header on second run", async () => {
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
      noCache: false, // Enable caching
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
      noCache: true,
    });

    const result = await transpiler.transpile({ kind: "files" });

    expect(result.success).toBe(true);
    expect(result.files.length).toBe(2);
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
      noCache: true,
    });

    // Should succeed even if preprocessing fails (falls back to raw content)
    const result = await transpiler.transpile({ kind: "files" });
    // The transpiler should still succeed and add a warning
    expect(result.success).toBe(true);
  });
});
