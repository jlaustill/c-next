/**
 * Shared Test Utilities
 *
 * Common interfaces and validation functions used by both
 * test.ts (main runner) and test-worker.ts (parallel worker).
 *
 * This module centralizes duplicated code to prevent drift
 * (e.g., validateMisra missing -I flag in one file but not the other).
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { execFileSync } from "node:child_process";
import Pipeline from "../src/pipeline/Pipeline";
import IFileResult from "../src/pipeline/types/IFileResult";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import ITools from "./types/ITools";
import IValidationResult from "./types/IValidationResult";
import ITestResult from "./types/ITestResult";

class TestUtils {
  /**
   * Normalize output for comparison (trim trailing whitespace, normalize line endings)
   */
  static normalize(str: string): string {
    return str
      .split("\n")
      .map((line) => line.trimEnd())
      .join("\n")
      .trim();
  }

  /**
   * Check if source has test-no-warnings marker in block comment
   */
  static hasNoWarningsMarker(source: string): boolean {
    return /\/\*\s*test-no-warnings\s*\*\//i.test(source);
  }

  /**
   * Issue #461: Check if source has test-transpile-only marker
   * Tests with this marker skip GCC compilation (e.g., C++ interop tests)
   */
  static hasTranspileOnlyMarker(source: string): boolean {
    return /\/\/\s*test-transpile-only/i.test(source);
  }

  /**
   * Check if generated C code requires ARM runtime (can't execute on x86)
   */
  static requiresArmRuntime(cCode: string): boolean {
    return (
      cCode.includes("cmsis_gcc.h") ||
      cCode.includes("__LDREX") ||
      cCode.includes("__STREX") ||
      cCode.includes("__get_PRIMASK") ||
      cCode.includes("__set_PRIMASK") ||
      cCode.includes("__disable_irq") ||
      cCode.includes("__enable_irq")
    );
  }

  /**
   * Get a unique path for a test executable in the temp directory
   */
  static getExecutablePath(cnxFile: string): string {
    const testName = basename(cnxFile, ".test.cnx");
    const uniqueId = randomBytes(4).toString("hex");
    return join(tmpdir(), `cnx-test-${testName}-${uniqueId}`);
  }

  /**
   * Check if code contains C++ features (without file I/O).
   * Extracted for testability - Issue #375.
   *
   * @param cCode - The C/C++ source code to analyze
   * @returns true if C++ features are detected
   */
  static hasCppFeatures(cCode: string): boolean {
    // Issue #267: Check for C++ casts (static_cast, reinterpret_cast)
    if (
      /\b(static_cast|reinterpret_cast|const_cast|dynamic_cast)\s*</.test(cCode)
    ) {
      return true;
    }

    // Issue #291: Check for C++ template types (Type<Args>)
    // Excludes string<N> which is C-Next bounded string syntax
    if (/\b(?!string\b)\w+<[^;=<>]+>/.test(cCode)) {
      return true;
    }

    // Issue #322: Check for C++ scope resolution operator (::)
    if (/\w+::\w+/.test(cCode)) {
      return true;
    }

    // Issue #375: Check for C++ constructor call syntax
    // Pattern: TypeName varName(args); at global scope
    // Matches lines like "Adafruit_MAX31856 thermocouple(pin);"
    // Excludes: return statements, control flow, function calls
    if (
      /^\s*(?!return\b|if\b|while\b|for\b|switch\b|case\b|else\b|do\b|break\b|continue\b|goto\b|sizeof\b|typeof\b|alignof\b)\w+\s+\w+\([^)]*\)\s*;/m.test(
        cCode,
      )
    ) {
      return true;
    }

    return false;
  }

  /**
   * Detect if a C file requires C++ compilation (g++ instead of gcc)
   *
   * Checks for:
   * - C++ casts: static_cast, reinterpret_cast, etc. (Issue #267)
   * - C++ template types: Type<Args> (Issue #291)
   * - C++14 typed enums: enum Foo : type { (in included headers)
   *
   * Note: Named "requiresCpp14" for historical reasons, but now detects
   * any C++ feature that requires g++ compilation.
   *
   * @param cFile - Path to the C file
   * @param _rootDir - Project root directory (unused, kept for API consistency)
   */
  static requiresCpp14(cFile: string, _rootDir?: string): boolean {
    try {
      const cCode = readFileSync(cFile, "utf-8");
      const cFileDir = dirname(cFile);

      // Check inline code for C++ features
      if (TestUtils.hasCppFeatures(cCode)) {
        return true;
      }

      // Find all #include "local_header.h" directives
      const includePattern = /#include\s+"([^"]+)"/g;
      let match;

      while ((match = includePattern.exec(cCode)) !== null) {
        const headerPath = join(cFileDir, match[1]);
        if (existsSync(headerPath)) {
          const headerContent = readFileSync(headerPath, "utf-8");
          // Check for C++14 typed enum syntax: enum Name : type {
          if (/enum\s+\w+\s*:\s*\w+\s*\{/.test(headerContent)) {
            return true;
          }
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Validate that a C file compiles without errors
   * Uses gcc with -fsyntax-only for fast syntax checking
   * Auto-detects C++14 headers and uses g++ when needed
   *
   * @param cFile - Path to the C file
   * @param _tools - Available tools (unused, kept for API consistency)
   * @param rootDir - Project root directory for include paths
   */
  static validateCompilation(
    cFile: string,
    _tools: ITools,
    rootDir: string,
  ): IValidationResult {
    try {
      // Auto-detect C++14 headers and use g++ when needed
      const useCpp = TestUtils.requiresCpp14(cFile);
      const compiler = useCpp ? "g++" : "gcc";
      const stdFlag = useCpp ? "-std=c++14" : "-std=c99";

      // Use compiler to check syntax only (no object file generated)
      // Suppress warnings about unused variables and void main (common in tests)
      // -I tests/include for stub headers (e.g., cmsis_gcc.h for ARM intrinsics)
      // -I cFileDir for local headers (e.g., test helpers in the same directory)
      const cFileDir = dirname(cFile);
      execFileSync(
        compiler,
        [
          "-fsyntax-only",
          stdFlag,
          "-Wno-unused-variable",
          "-Wno-main",
          "-I",
          join(rootDir, "tests/include"),
          "-I",
          cFileDir,
          cFile,
        ],
        { encoding: "utf-8", timeout: 10000, stdio: "pipe" },
      );
      return { valid: true };
    } catch (error: unknown) {
      const err = error as {
        stderr?: string;
        stdout?: string;
        message: string;
      };
      // Extract just the error messages
      const output = err.stderr || err.stdout || err.message;
      const errors = output
        .split("\n")
        .filter((line) => line.includes("error:"))
        .map((line) => line.replace(cFile + ":", ""))
        .slice(0, 5)
        .join("\n");
      return {
        valid: false,
        message: errors || "Compilation failed",
      };
    }
  }

  /**
   * Validate that a C file passes cppcheck static analysis
   * Auto-detects C++14 headers and uses --language=c++ when needed
   */
  static validateCppcheck(cFile: string): IValidationResult {
    try {
      // Issue #251/#252: Auto-detect C++14 headers and use C++ mode when needed
      const useCpp = TestUtils.requiresCpp14(cFile);
      const args = [
        "--error-exitcode=1",
        "--enable=warning,performance",
        "--suppress=unusedFunction",
        "--suppress=missingIncludeSystem",
        "--suppress=unusedVariable",
        // Issue #321: Suppress Arduino header warnings (external code we can't modify)
        "--suppress=uninitMemberVar:*fixtures/*",
        "--quiet",
      ];

      if (useCpp) {
        args.push("--language=c++");
        args.push("--std=c++14");
      }

      args.push(cFile);

      execFileSync("cppcheck", args, {
        encoding: "utf-8",
        timeout: 90000,
        stdio: "pipe",
      });
      return { valid: true };
    } catch (error: unknown) {
      const err = error as {
        stderr?: string;
        stdout?: string;
        message: string;
      };
      const output = err.stderr || err.stdout || err.message;
      const issues = output
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .slice(0, 5)
        .join("\n");
      return {
        valid: false,
        message: issues || "Cppcheck failed",
      };
    }
  }

  /**
   * Validate that a C file passes clang-tidy analysis
   * Auto-detects C++14 headers and uses -std=c++14 when needed
   */
  static validateClangTidy(cFile: string): IValidationResult {
    try {
      // Issue #251/#252: Auto-detect C++14 headers and use C++ mode when needed
      const useCpp = TestUtils.requiresCpp14(cFile);
      const stdFlag = useCpp ? "-std=c++14" : "-std=c99";

      // Run clang-tidy with safety and readability checks
      execFileSync(
        "clang-tidy",
        [cFile, "--", stdFlag, "-Wno-unused-variable"],
        { encoding: "utf-8", timeout: 30000, stdio: "pipe" },
      );
      return { valid: true };
    } catch (error: unknown) {
      const err = error as {
        stderr?: string;
        stdout?: string;
        message: string;
      };
      const output = err.stderr || err.stdout || err.message;
      // Filter for actual warnings/errors (not notes)
      const issues = output
        .split("\n")
        .filter((line) => line.includes("warning:") || line.includes("error:"))
        .slice(0, 5)
        .join("\n");
      // clang-tidy returns non-zero even for warnings, only fail on errors
      if (issues.includes("error:")) {
        return {
          valid: false,
          message: issues || "Clang-tidy failed",
        };
      }
      return { valid: true };
    }
  }

  /**
   * Validate that a C file passes MISRA C compliance check
   * Uses cppcheck's MISRA addon
   * Note: MISRA C is only for C code, not C++. Skips validation for C++ files.
   *
   * @param cFile - Path to the C file
   * @param rootDir - Project root directory for include paths
   */
  static validateMisra(cFile: string, rootDir: string): IValidationResult {
    try {
      // Issue #251/#252: Skip MISRA for C++ files (MISRA C is only for C code)
      if (TestUtils.requiresCpp14(cFile)) {
        return { valid: true };
      }

      // Issue #315: Include the C file's directory for local headers
      const cFileDir = dirname(cFile);

      // Run cppcheck with MISRA addon
      // Include -I flag for tests/include to resolve stub headers
      // Include -I flag for cFileDir for local headers
      execFileSync(
        "cppcheck",
        [
          "--addon=misra",
          "--error-exitcode=1",
          "--suppress=missingIncludeSystem",
          "--suppress=unusedFunction",
          "--quiet",
          "-I",
          join(rootDir, "tests/include"),
          "-I",
          cFileDir,
          cFile,
        ],
        { encoding: "utf-8", timeout: 60000, stdio: "pipe" },
      );
      return { valid: true };
    } catch (error: unknown) {
      const err = error as {
        stderr?: string;
        stdout?: string;
        message: string;
      };
      const output = err.stderr || err.stdout || err.message;
      const issues = output
        .split("\n")
        .filter((line) => line.includes("misra") || line.includes("MISRA"))
        .slice(0, 5)
        .join("\n");
      return {
        valid: false,
        message: issues || "MISRA check failed",
      };
    }
  }

  /**
   * Validate that a C file passes flawfinder security analysis
   * flawfinder scans C code for CWE-mapped security vulnerabilities
   *
   * @param cFile - Path to the C file
   */
  static validateFlawfinder(cFile: string): IValidationResult {
    try {
      // Run flawfinder with:
      // --minlevel=3: Skip low-risk (0-2) to reduce noise from char[] static buffers
      //   (C-Next uses static allocation per ADR-003, so level 2 char[] warnings are FPs)
      // --error-level=3: Return non-zero exit for level 3+ findings (medium risk+)
      // --dataonly: Output data only, no headers
      // --quiet: Don't show progress
      execFileSync(
        "flawfinder",
        ["--minlevel=3", "--error-level=3", "--dataonly", "--quiet", cFile],
        { encoding: "utf-8", timeout: 30000, stdio: "pipe" },
      );
      return { valid: true };
    } catch (error: unknown) {
      const err = error as {
        stderr?: string;
        stdout?: string;
        message: string;
      };
      const output = err.stdout || err.stderr || err.message;
      // Parse flawfinder output for CWE identifiers
      const issues = output
        .split("\n")
        .filter((line) => line.includes("CWE") || line.includes(cFile))
        .slice(0, 5)
        .join("\n");
      return {
        valid: false,
        message: issues || "Flawfinder security check failed",
      };
    }
  }

  /**
   * Validate that a C file compiles without any warnings
   * Uses gcc with -Werror to treat all warnings as errors
   *
   * @param cFile - Path to the C file
   * @param rootDir - Project root directory for include paths
   */
  static validateNoWarnings(cFile: string, rootDir: string): IValidationResult {
    try {
      // Auto-detect C++14 headers and use g++ when needed
      const useCpp = TestUtils.requiresCpp14(cFile);
      const compiler = useCpp ? "g++" : "gcc";
      const stdFlag = useCpp ? "-std=c++14" : "-std=c99";

      // Compile with -Werror to treat warnings as errors
      // Include common warning flags that catch issues like -Wstringop-overflow
      execFileSync(
        compiler,
        [
          "-fsyntax-only",
          stdFlag,
          "-Wall",
          "-Wextra",
          "-Werror",
          "-Wno-unused-variable",
          "-Wno-main",
          "-I",
          join(rootDir, "tests/include"),
          cFile,
        ],
        { encoding: "utf-8", timeout: 10000, stdio: "pipe" },
      );
      return { valid: true };
    } catch (error: unknown) {
      const err = error as {
        stderr?: string;
        stdout?: string;
        message: string;
      };
      // Extract just the warning/error messages
      const output = err.stderr || err.stdout || err.message;
      const warnings = output
        .split("\n")
        .filter((line) => line.includes("warning:") || line.includes("error:"))
        .map((line) => line.replace(cFile + ":", ""))
        .slice(0, 5)
        .join("\n");
      return {
        valid: false,
        message: warnings || "Compilation produced warnings",
      };
    }
  }

  /**
   * Find helper .cnx files that are included by a test file
   * Parses the source for #include <file.cnx> or #include "file.cnx" directives
   * Only returns files in the same directory as the test (for cross-file execution)
   */
  static findHelperCnxFiles(testFile: string, source?: string): string[] {
    const testDir = dirname(testFile);
    const helperFiles: string[] = [];

    // If source is provided, parse it for .cnx includes
    if (source) {
      // Match #include <file.cnx> or #include "file.cnx"
      const includeRegex = /#include\s*[<"]([^>"]+\.cnx)[>"]/g;
      let match;
      while ((match = includeRegex.exec(source)) !== null) {
        const includedFile = match[1];
        // Check if the file exists in the test directory
        const fullPath = join(testDir, includedFile);
        if (existsSync(fullPath) && !includedFile.endsWith(".test.cnx")) {
          helperFiles.push(fullPath);
        }
      }
    }

    return helperFiles;
  }

  /**
   * Compile and execute a C file, validating exit code
   *
   * @param cFile - Path to the C file
   * @param rootDir - Project root directory for include paths
   * @param expectedExitCode - Expected exit code (default: 0)
   * @param additionalCFiles - Additional C files to compile and link (for cross-file tests)
   */
  static executeTest(
    cFile: string,
    rootDir: string,
    expectedExitCode: number = 0,
    additionalCFiles: string[] = [],
  ): IValidationResult & { stdout?: string } {
    const execPath = TestUtils.getExecutablePath(cFile);

    // Auto-detect C++14 headers and use g++ when needed
    const useCpp = TestUtils.requiresCpp14(cFile);
    const compiler = useCpp ? "g++" : "gcc";
    const stdFlag = useCpp ? "-std=c++14" : "-std=c99";

    // Issue #315: Include the C file's directory for local headers
    const cFileDir = dirname(cFile);

    // All source files to compile (main + helpers)
    const sourceFiles = [cFile, ...additionalCFiles];

    try {
      // Compile to executable
      execFileSync(
        compiler,
        [
          stdFlag,
          "-Wno-unused-variable",
          "-Wno-main",
          "-I",
          join(rootDir, "tests/include"),
          "-I",
          cFileDir,
          "-o",
          execPath,
          ...sourceFiles,
        ],
        { encoding: "utf-8", timeout: 30000, stdio: "pipe" },
      );

      // Execute the compiled program
      try {
        const stdout = execFileSync(execPath, [], {
          encoding: "utf-8",
          timeout: 5000,
          stdio: "pipe",
        });

        // Program exited with 0
        if (expectedExitCode !== 0) {
          return {
            valid: false,
            message: `Expected exit ${expectedExitCode}, got 0`,
            stdout,
          };
        }
        return { valid: true, stdout };
      } catch (execError: unknown) {
        const err = execError as { status?: number; stdout?: string };
        const actualCode = err.status || 1;

        if (actualCode === expectedExitCode) {
          return { valid: true, stdout: err.stdout };
        }

        return {
          valid: false,
          message: `Expected exit 0, got ${actualCode}`,
          stdout: err.stdout,
        };
      }
    } catch (compileError: unknown) {
      const err = compileError as { stderr?: string; message: string };
      const output = err.stderr || err.message;
      return {
        valid: false,
        message: `Compile failed: ${output.split("\n")[0]}`,
      };
    } finally {
      // Clean up executable
      try {
        if (existsSync(execPath)) {
          unlinkSync(execPath);
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  }
  /**
   * Run a single test file
   *
   * This is the core test runner logic, shared between test.ts (sequential mode)
   * and test-worker.ts (parallel mode). Extracted to eliminate ~400 lines of duplication.
   *
   * @param cnxFile - Path to the .test.cnx file
   * @param updateMode - Whether to update snapshots
   * @param tools - Available validation tools
   * @param rootDir - Project root directory
   */
  static async runTest(
    cnxFile: string,
    updateMode: boolean,
    tools: ITools,
    rootDir: string,
  ): Promise<ITestResult> {
    const source = readFileSync(cnxFile, "utf-8");

    // Check for incorrect test-execution marker format (Issue #322)
    // The correct format is "// test-execution" (single-line comment)
    // Fail early if the incorrect block comment format is used
    if (/\/\*\s*test-execution\s*\*\//.test(source)) {
      return {
        passed: false,
        message:
          'Invalid test-execution marker: use "// test-execution" not "/* test-execution */"',
      };
    }

    const basePath = cnxFile.replace(/\.test\.cnx$/, "");
    const expectedCFile = basePath + ".expected.c";
    const expectedErrorFile = basePath + ".expected.error";
    const expectedHFile = basePath + ".expected.h";
    const headerFile = basePath + ".test.h";

    // Issue #455: Check if .expected.h exists (for header validation tests)
    const hasExpectedHFile = existsSync(expectedHFile);

    // Use Pipeline for transpilation with header parsing support
    // Issue #321: Use noCache: true to ensure tests always use fresh symbol collection
    // Caching can cause stale symbols when Pipeline code changes
    const pipeline = new Pipeline({
      inputs: [],
      includeDirs: [join(rootDir, "tests/include")],
      noCache: true,
    });

    // Enable header generation if:
    // 1. .test.h file exists (legacy behavior), OR
    // 2. .expected.c includes the header file (Issue #455)
    const result: IFileResult = await pipeline.transpileSource(source, {
      workingDir: dirname(cnxFile),
      sourcePath: cnxFile,
    });

    // Issue #322: Find and transpile helper .cnx files for cross-file execution tests
    // Use test file basename for unique temp file naming to avoid parallel test collisions
    const testBaseName = basename(cnxFile, ".test.cnx");
    const helperCnxFiles = TestUtils.findHelperCnxFiles(cnxFile, source);
    const helperCFiles: string[] = [];
    const tempHelperFiles: string[] = [];

    // Cleanup helper function for temp files (defined early for use in validation)
    const cleanupHelperFiles = (): void => {
      for (const f of tempHelperFiles) {
        try {
          if (existsSync(f)) unlinkSync(f);
        } catch {
          // Ignore cleanup errors
        }
      }
    };

    for (const helperCnx of helperCnxFiles) {
      const helperSource = readFileSync(helperCnx, "utf-8");
      // Use fresh Pipeline for each helper to avoid symbol pollution from main test
      const helperPipeline = new Pipeline({
        inputs: [],
        includeDirs: [join(rootDir, "tests/include")],
        noCache: true,
      });
      const helperResult = await helperPipeline.transpileSource(helperSource, {
        workingDir: dirname(helperCnx),
        sourcePath: helperCnx,
      });
      if (helperResult.success) {
        // Write to temp file with unique name per test to avoid parallel collisions
        const helperBaseName = basename(helperCnx, ".cnx");
        const tempCFile = join(
          dirname(helperCnx),
          `${helperBaseName}.${testBaseName}.tmp.c`,
        );
        writeFileSync(tempCFile, helperResult.code);
        helperCFiles.push(tempCFile);
        tempHelperFiles.push(tempCFile);

        // Issue #461: Write helper header file if generated (needed for GCC to find includes)
        // Always write to .h path for compilation, validate against .expected.h if exists
        if (helperResult.headerCode) {
          const tempHFile = join(dirname(helperCnx), `${helperBaseName}.h`);
          const helperExpectedHFile = join(
            dirname(helperCnx),
            `${helperBaseName}.expected.h`,
          );

          writeFileSync(tempHFile, helperResult.headerCode);

          // Update mode: create .expected.h if it doesn't exist
          if (updateMode && !existsSync(helperExpectedHFile)) {
            writeFileSync(helperExpectedHFile, helperResult.headerCode);
          }

          // Only clean up if there's no .expected.h - helpers with .expected.h are persistent
          if (!existsSync(helperExpectedHFile)) {
            tempHelperFiles.push(tempHFile);
          }

          // Validate against expected header if it exists
          if (existsSync(helperExpectedHFile)) {
            const expectedH = readFileSync(helperExpectedHFile, "utf-8");
            if (
              TestUtils.normalize(helperResult.headerCode) !==
              TestUtils.normalize(expectedH)
            ) {
              cleanupHelperFiles();
              return {
                passed: false,
                message: `Helper header mismatch: ${helperBaseName}.h`,
                expected: expectedH,
                actual: helperResult.headerCode,
              };
            }
          }
        }
      }
    }

    // Check if this is an error test (no validation needed for error tests)
    if (existsSync(expectedErrorFile)) {
      const expectedErrors = readFileSync(expectedErrorFile, "utf-8").trim();

      // Clean up stale success test artifacts (from when this was a success test)
      for (const staleFile of [expectedCFile, expectedHFile, headerFile]) {
        if (existsSync(staleFile)) {
          try {
            unlinkSync(staleFile);
          } catch {
            // Ignore cleanup errors
          }
        }
      }

      if (result.success) {
        // In update mode, switch from error test to success test
        if (updateMode) {
          unlinkSync(expectedErrorFile);
          writeFileSync(expectedCFile, result.code);
          cleanupHelperFiles();
          return {
            passed: true,
            message: "Switched from error to C snapshot",
            updated: true,
          };
        }
        cleanupHelperFiles();
        return {
          passed: false,
          message: `Expected errors but transpilation succeeded`,
          expected: expectedErrors,
          actual: "(no errors)",
        };
      }

      const actualErrors = result.errors
        .map((e) => `${e.line}:${e.column} ${e.message}`)
        .join("\n");

      if (updateMode) {
        writeFileSync(expectedErrorFile, actualErrors + "\n");
        cleanupHelperFiles();
        return {
          passed: true,
          message: "Updated error snapshot",
          updated: true,
        };
      }

      if (
        TestUtils.normalize(actualErrors) ===
        TestUtils.normalize(expectedErrors)
      ) {
        cleanupHelperFiles();
        return { passed: true };
      }

      cleanupHelperFiles();
      return {
        passed: false,
        message: "Error output mismatch",
        expected: expectedErrors,
        actual: actualErrors,
      };
    }

    // Check if this is a success test
    if (existsSync(expectedCFile)) {
      const expectedC = readFileSync(expectedCFile, "utf-8");

      if (!result.success) {
        const errors = result.errors
          .map((e) => `${e.line}:${e.column} ${e.message}`)
          .join("\n");
        // In update mode, switch from success test to error test
        if (updateMode) {
          unlinkSync(expectedCFile);
          writeFileSync(expectedErrorFile, errors + "\n");
          cleanupHelperFiles();
          return {
            passed: true,
            message: "Switched from C to error snapshot",
            updated: true,
          };
        }
        cleanupHelperFiles();
        return {
          passed: false,
          message: `Transpilation failed unexpectedly`,
          expected: "(success)",
          actual: errors,
        };
      }

      if (updateMode) {
        writeFileSync(expectedCFile, result.code);
        // Issue #424: Also update header snapshot if header was generated
        if (result.headerCode) {
          writeFileSync(expectedHFile, result.headerCode);
        }
        cleanupHelperFiles();
        return { passed: true, message: "Updated C snapshot", updated: true };
      }

      if (TestUtils.normalize(result.code) === TestUtils.normalize(expectedC)) {
        // Snapshot matches - now run all validation steps

        // Issue #455: Write header file to disk if generated AND expected.h exists
        // Only write headers for tests that expect header validation
        if (result.headerCode && hasExpectedHFile) {
          writeFileSync(headerFile, result.headerCode);
        }

        // Helper to cleanup temp files (header files are preserved for success tests)
        const cleanupAllFiles = (): void => {
          cleanupHelperFiles();
        };

        // Issue #461: Skip all C compilation validation for transpile-only tests (e.g., C++ interop)
        const isTranspileOnly = TestUtils.hasTranspileOnlyMarker(source);

        // Step 1: GCC compilation
        if (tools.gcc && !isTranspileOnly) {
          const compileResult = TestUtils.validateCompilation(
            expectedCFile,
            tools,
            rootDir,
          );
          if (!compileResult.valid) {
            cleanupAllFiles();
            return {
              passed: false,
              message: "GCC compilation failed",
              actual: compileResult.message,
            };
          }
        }

        // Step 2: Cppcheck static analysis
        if (tools.cppcheck && !isTranspileOnly) {
          const cppcheckResult = TestUtils.validateCppcheck(expectedCFile);
          if (!cppcheckResult.valid) {
            cleanupAllFiles();
            return {
              passed: false,
              message: "Cppcheck failed",
              actual: cppcheckResult.message,
            };
          }
        }

        // Step 3: Clang-tidy analysis
        if (tools.clangTidy && !isTranspileOnly) {
          const clangTidyResult = TestUtils.validateClangTidy(expectedCFile);
          if (!clangTidyResult.valid) {
            cleanupAllFiles();
            return {
              passed: false,
              message: "Clang-tidy failed",
              actual: clangTidyResult.message,
            };
          }
        }

        // Step 4: MISRA compliance check
        if (tools.misra && !isTranspileOnly) {
          const misraResult = TestUtils.validateMisra(expectedCFile, rootDir);
          if (!misraResult.valid) {
            cleanupAllFiles();
            return {
              passed: false,
              message: "MISRA check failed",
              actual: misraResult.message,
            };
          }
        }

        // Step 5: Flawfinder security analysis
        if (tools.flawfinder && !isTranspileOnly) {
          const flawfinderResult = TestUtils.validateFlawfinder(expectedCFile);
          if (!flawfinderResult.valid) {
            cleanupAllFiles();
            return {
              passed: false,
              message: "Flawfinder security check failed",
              actual: flawfinderResult.message,
            };
          }
        }

        // Step 6: No-warnings check (if /* test-no-warnings */ marker present)
        if (TestUtils.hasNoWarningsMarker(source) && !isTranspileOnly) {
          const noWarningsResult = TestUtils.validateNoWarnings(
            expectedCFile,
            rootDir,
          );
          if (!noWarningsResult.valid) {
            cleanupAllFiles();
            return {
              passed: false,
              message: "Warning check failed (test-no-warnings)",
              warningError: noWarningsResult.message,
            };
          }
        }

        // Step 6.5: Header validation (if .expected.h file exists AND headers were generated) - Issue #424
        // Issue #461: Skip header validation for transpile-only tests
        if (hasExpectedHFile && result.headerCode && !isTranspileOnly) {
          const expectedH = readFileSync(expectedHFile, "utf-8");
          const actualH = result.headerCode;

          if (TestUtils.normalize(actualH) !== TestUtils.normalize(expectedH)) {
            cleanupAllFiles();
            return {
              passed: false,
              message: "Header output mismatch",
              expected: expectedH,
              actual: actualH,
            };
          }
        }

        // Step 7: Execution test (if // test-execution marker present)
        if (/^\s*\/\/\s*test-execution\s*$/m.test(source)) {
          if (TestUtils.requiresArmRuntime(result.code)) {
            cleanupAllFiles();
            return { passed: true, skippedExec: true };
          }

          const execResult = TestUtils.executeTest(
            expectedCFile,
            rootDir,
            0,
            helperCFiles,
          );
          cleanupAllFiles();
          if (!execResult.valid) {
            return {
              passed: false,
              message: "Execution failed",
              actual: execResult.message,
            };
          }
        }

        cleanupAllFiles();
        return { passed: true };
      }

      // Snapshot mismatch - but still try to execute if marker present
      if (/^\s*\/\/\s*test-execution\s*$/m.test(source)) {
        // Write transpiled code to temp file for execution
        const tempCFile = expectedCFile.replace(".expected.c", ".tmp.c");
        writeFileSync(tempCFile, result.code);

        // Issue #461: Write header file if generated AND expected.h exists
        let tempHeaderWritten = false;
        if (result.headerCode && hasExpectedHFile) {
          writeFileSync(headerFile, result.headerCode);
          tempHeaderWritten = true;
        }

        try {
          if (!TestUtils.requiresArmRuntime(result.code)) {
            const execResult = TestUtils.executeTest(
              tempCFile,
              rootDir,
              0,
              helperCFiles,
            );
            if (!execResult.valid) {
              cleanupHelperFiles();
              return {
                passed: false,
                message: "C output mismatch AND execution failed",
                expected: expectedC,
                actual: result.code,
                execError: execResult.message,
              };
            }
          }
        } finally {
          try {
            unlinkSync(tempCFile);
          } catch {
            // Ignore cleanup errors
          }
          // Clean up temp header file if we created it and no expected.h exists
          if (tempHeaderWritten && !hasExpectedHFile) {
            try {
              unlinkSync(headerFile);
            } catch {
              // Ignore cleanup errors
            }
          }
        }
      }

      cleanupHelperFiles();
      return {
        passed: false,
        message: "C output mismatch",
        expected: expectedC,
        actual: result.code,
      };
    }

    // No expected file - in update mode, create one
    if (updateMode) {
      if (result.success) {
        writeFileSync(expectedCFile, result.code);
        cleanupHelperFiles();
        return { passed: true, message: "Created C snapshot", updated: true };
      } else {
        const errors = result.errors
          .map((e) => `${e.line}:${e.column} ${e.message}`)
          .join("\n");
        writeFileSync(expectedErrorFile, errors + "\n");
        cleanupHelperFiles();
        return {
          passed: true,
          message: "Created error snapshot",
          updated: true,
        };
      }
    }

    // No expected file and not in update mode
    cleanupHelperFiles();
    return {
      passed: false,
      message: "No expected file found. Run with --update to create snapshot.",
      noSnapshot: true,
    };
  }
}

export default TestUtils;
