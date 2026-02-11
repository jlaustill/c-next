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
import Transpiler from "../src/transpiler/Transpiler";
import IFileResult from "../src/transpiler/types/IFileResult";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import ITools from "./types/ITools";
import IValidationResult from "./types/IValidationResult";
import ITestResult from "./types/ITestResult";
import type { TTestMode, IModeResult } from "./types/ITestMode";
import detectCppSyntax from "../src/transpiler/logic/detectCppSyntax";

// Shared patterns for distinguishing C++ constructors from C function prototypes
const C_KEYWORDS =
  "return|if|while|for|switch|case|else|do|break|continue|goto|sizeof|typeof|alignof";
const C_TYPES =
  "void|int|char|float|double|long|short|unsigned|signed|bool|enum|struct|union|static|extern|const|volatile|inline|u?int\\d+_t|size_t";

class TestUtils {
  // First word of a line that is NOT a C++ constructor (keywords + C types)
  static readonly NON_CONSTRUCTOR_FIRST_WORD = new RegExp(
    `^(${C_KEYWORDS}|${C_TYPES})$`,
  );
  // Type keywords appearing in function arguments indicate a prototype, not a constructor
  static readonly C_TYPE_IN_ARGS = new RegExp(`\\b(${C_TYPES})\\b`);

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
   * Check if source has test-c-only marker
   * Tests with this marker run ONLY in C mode (e.g., MISRA-specific tests)
   */
  static hasCOnlyMarker(source: string): boolean {
    return /\/\/\s*test-c-only/i.test(source);
  }

  /**
   * Check if source has test-cpp-only marker
   * Tests with this marker run ONLY in C++ mode (e.g., C++ template interop tests)
   */
  static hasCppOnlyMarker(source: string): boolean {
    return /\/\/\s*test-cpp-only/i.test(source);
  }

  /**
   * Check if source has test-no-exec marker
   * Tests with this marker skip execution (compile only, no run)
   */
  static hasNoExecMarker(source: string): boolean {
    return /\/\/\s*test-no-exec/i.test(source);
  }

  /**
   * Determine which test modes to run based on markers
   * Default: run both C and C++ modes
   */
  static getTestModes(source: string): TTestMode[] {
    if (TestUtils.hasCOnlyMarker(source)) return ["c"];
    if (TestUtils.hasCppOnlyMarker(source)) return ["cpp"];
    return ["c", "cpp"]; // Default: both modes
  }

  /**
   * Get expected file paths for a given mode
   */
  static getExpectedPaths(
    basePath: string,
    mode: TTestMode,
  ): { expectedImpl: string; expectedHeader: string; tempImpl: string } {
    const implExt = mode === "cpp" ? "cpp" : "c";
    const headerExt = mode === "cpp" ? "hpp" : "h";
    return {
      expectedImpl: `${basePath}.expected.${implExt}`,
      expectedHeader: `${basePath}.expected.${headerExt}`,
      tempImpl: `${basePath}.test.${implExt}`,
    };
  }

  /**
   * Get compiler and flags for a given mode
   */
  static getCompilerConfig(mode: TTestMode): {
    compiler: string;
    stdFlag: string;
  } {
    if (mode === "cpp") {
      return { compiler: "g++", stdFlag: "-std=c++14" };
    }
    return { compiler: "gcc", stdFlag: "-std=c99" };
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
    // Excludes: keywords, C types, and function prototypes (args contain type keywords)
    // Split into two patterns to reduce regex complexity (SonarCloud S5843)
    const constructorMatch = /^\s*(\w+)\s+\w+\(([^)]*)\)\s*;/m.exec(cCode);
    if (constructorMatch) {
      const firstWord = constructorMatch[1];
      const argsContent = constructorMatch[2];
      const isKeywordOrCType =
        TestUtils.NON_CONSTRUCTOR_FIRST_WORD.test(firstWord);
      // Function prototypes have type keywords in args (e.g., "const int* x");
      // constructor calls have plain values (e.g., "pin, 42")
      const argsHaveTypes = TestUtils.C_TYPE_IN_ARGS.test(argsContent);
      if (!isKeywordOrCType && !argsHaveTypes) {
        return true;
      }
    }

    return false;
  }

  /**
   * Detect if a C file requires C++ compilation (g++ instead of gcc)
   *
   * Checks for:
   * - C++ casts: static_cast, reinterpret_cast, etc. (Issue #267)
   * - C++ template types: Type<Args> (Issue #291)
   * - C++ structural syntax in headers: class, namespace, template, access specifiers, typed enums
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
          // Use transpiler's robust C++ detection for headers
          if (detectCppSyntax(headerContent)) {
            return true;
          }
          // Also check for inline C++ code in headers (casts, ::, constructors)
          if (TestUtils.hasCppFeatures(headerContent)) {
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
        args.push("--language=c++", "--std=c++14");
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
   * Run a test in a single mode (C or C++)
   *
   * This handles transpilation, snapshot comparison, header validation,
   * compilation, and execution for ONE specific mode.
   *
   * @param cnxFile - Path to the .test.cnx file
   * @param source - Source code content
   * @param mode - The test mode ('c' or 'cpp')
   * @param updateMode - Whether to update snapshots
   * @param tools - Available validation tools
   * @param rootDir - Project root directory
   * @param shouldExec - Whether to run execution tests
   * @param helperCnxFiles - Helper .cnx files to also transpile
   */
  static async runTestMode(
    cnxFile: string,
    source: string,
    mode: TTestMode,
    updateMode: boolean,
    tools: ITools,
    rootDir: string,
    shouldExec: boolean,
    helperCnxFiles: string[],
  ): Promise<IModeResult> {
    const basePath = cnxFile.replace(/\.test\.cnx$/, "");
    const paths = TestUtils.getExpectedPaths(basePath, mode);
    const testBaseName = basename(cnxFile, ".test.cnx");

    // Initialize result
    const result: IModeResult = {
      mode,
      transpileSuccess: false,
      snapshotMatch: false,
      headerMatch: false,
      compileSuccess: false,
      execSuccess: false,
    };

    // Transpile with mode-specific settings
    const pipeline = new Transpiler({
      inputs: [],
      includeDirs: [join(rootDir, "tests/include")],
      noCache: true,
      cppRequired: mode === "cpp",
    });

    const transpileResult: IFileResult = await pipeline.transpileSource(
      source,
      {
        workingDir: dirname(cnxFile),
        sourcePath: cnxFile,
      },
    );

    if (!transpileResult.success) {
      const errors = transpileResult.errors
        .map((e) => `${e.line}:${e.column} ${e.message}`)
        .join("\n");
      result.error = `Transpilation failed: ${errors}`;
      return result;
    }

    result.transpileSuccess = true;

    // Transpile helper files
    const helperImplFiles: string[] = [];
    const tempHelperFiles: string[] = [];

    for (const helperCnx of helperCnxFiles) {
      const helperSource = readFileSync(helperCnx, "utf-8");
      const helperTranspiler = new Transpiler({
        inputs: [],
        includeDirs: [join(rootDir, "tests/include")],
        noCache: true,
        cppRequired: mode === "cpp",
      });
      const helperResult = await helperTranspiler.transpileSource(
        helperSource,
        {
          workingDir: dirname(helperCnx),
          sourcePath: helperCnx,
        },
      );
      if (helperResult.success) {
        const helperBaseName = basename(helperCnx, ".cnx");
        const implExt = mode === "cpp" ? "cpp" : "c";
        const tempImplFile = join(
          dirname(helperCnx),
          `${helperBaseName}.${testBaseName}.tmp.${implExt}`,
        );
        writeFileSync(tempImplFile, helperResult.code);
        helperImplFiles.push(tempImplFile);
        tempHelperFiles.push(tempImplFile);

        // Write helper header if generated
        if (helperResult.headerCode) {
          const headerExt = mode === "cpp" ? "hpp" : "h";
          const tempHFile = join(
            dirname(helperCnx),
            `${helperBaseName}.${headerExt}`,
          );
          writeFileSync(tempHFile, helperResult.headerCode);
          // Only track for cleanup if no persistent expected file exists
          const helperExpectedH = join(
            dirname(helperCnx),
            `${helperBaseName}.expected.${headerExt}`,
          );
          if (!existsSync(helperExpectedH)) {
            tempHelperFiles.push(tempHFile);
          }
        }
      }
    }

    // Cleanup helper for temp files
    const cleanupHelpers = (): void => {
      for (const f of tempHelperFiles) {
        try {
          if (existsSync(f)) unlinkSync(f);
        } catch {
          // Ignore cleanup errors
        }
      }
    };

    // Check expected file exists (no fallbacks - tests must have proper expected files)
    const expectedImplPath = paths.expectedImpl;
    const expectedHeaderPath = paths.expectedHeader;
    const hasExpectedImpl = existsSync(expectedImplPath);
    const hasExpectedHeader = existsSync(expectedHeaderPath);

    // Update mode: create/update snapshots
    if (updateMode) {
      writeFileSync(paths.expectedImpl, transpileResult.code);
      if (transpileResult.headerCode) {
        writeFileSync(paths.expectedHeader, transpileResult.headerCode);
      }
      result.snapshotMatch = true;
      result.headerMatch = true;
      result.compileSuccess = true;
      result.execSuccess = true;
      cleanupHelpers();
      return result;
    }

    // No expected file - skip this mode
    if (!hasExpectedImpl) {
      result.error = `No expected file: ${paths.expectedImpl}`;
      cleanupHelpers();
      return result;
    }

    // Compare implementation snapshot
    const expectedImpl = readFileSync(expectedImplPath, "utf-8");
    if (
      TestUtils.normalize(transpileResult.code) !==
      TestUtils.normalize(expectedImpl)
    ) {
      result.error = `${mode.toUpperCase()} output mismatch`;
      result.expected = expectedImpl;
      result.actual = transpileResult.code;
      cleanupHelpers();
      return result;
    }
    result.snapshotMatch = true;

    // Compare header snapshot (if headers were generated)
    if (transpileResult.headerCode) {
      if (!hasExpectedHeader) {
        result.error = `Missing ${expectedHeaderPath} - headers were generated but no snapshot exists`;
        cleanupHelpers();
        return result;
      }
      const expectedHeader = readFileSync(expectedHeaderPath, "utf-8");
      if (
        TestUtils.normalize(transpileResult.headerCode) !==
        TestUtils.normalize(expectedHeader)
      ) {
        result.error = `${mode.toUpperCase()} header mismatch`;
        result.expected = expectedHeader;
        result.actual = transpileResult.headerCode;
        cleanupHelpers();
        return result;
      }
    }
    result.headerMatch = true;

    // Skip compilation for transpile-only tests
    const isTranspileOnly = TestUtils.hasTranspileOnlyMarker(source);
    if (isTranspileOnly) {
      result.compileSuccess = true;
      result.execSuccess = true;
      result.skippedExec = true;
      cleanupHelpers();
      return result;
    }

    // Compile with mode-specific compiler
    // Auto-detect C++ features in included headers and use g++ when needed
    const needsCppCompiler =
      mode === "cpp" || TestUtils.requiresCpp14(expectedImplPath);
    const actualCompiler = needsCppCompiler ? "g++" : "gcc";
    const actualStdFlag = needsCppCompiler ? "-std=c++14" : "-std=c99";

    if (tools.gcc) {
      try {
        const cFileDir = dirname(expectedImplPath);
        execFileSync(
          actualCompiler,
          [
            "-fsyntax-only",
            actualStdFlag,
            "-Wno-unused-variable",
            "-Wno-main",
            "-I",
            join(rootDir, "tests/include"),
            "-I",
            cFileDir,
            expectedImplPath,
          ],
          { encoding: "utf-8", timeout: 10000, stdio: "pipe" },
        );
        result.compileSuccess = true;
      } catch (error: unknown) {
        const err = error as {
          stderr?: string;
          stdout?: string;
          message: string;
        };
        const output = err.stderr || err.stdout || err.message;
        const errors = output
          .split("\n")
          .filter((line) => line.includes("error:"))
          .slice(0, 5)
          .join("\n");
        result.error = `${mode.toUpperCase()} compilation failed: ${errors}`;
        cleanupHelpers();
        return result;
      }
    } else {
      result.compileSuccess = true; // Skip if no gcc
    }

    // Run static analysis tools (C mode only - tools are C-specific)
    if (mode === "c") {
      // Step 1: cppcheck static analysis
      if (tools.cppcheck) {
        const cppcheckResult = TestUtils.validateCppcheck(expectedImplPath);
        if (!cppcheckResult.valid) {
          result.error = `cppcheck failed: ${cppcheckResult.message}`;
          cleanupHelpers();
          return result;
        }
      }

      // Step 2: clang-tidy analysis
      if (tools.clangTidy) {
        const clangTidyResult = TestUtils.validateClangTidy(expectedImplPath);
        if (!clangTidyResult.valid) {
          result.error = `clang-tidy failed: ${clangTidyResult.message}`;
          cleanupHelpers();
          return result;
        }
      }

      // Step 3: MISRA compliance
      if (tools.misra) {
        const misraResult = TestUtils.validateMisra(expectedImplPath, rootDir);
        if (!misraResult.valid) {
          result.error = `MISRA check failed: ${misraResult.message}`;
          cleanupHelpers();
          return result;
        }
      }

      // Step 4: flawfinder security analysis
      if (tools.flawfinder) {
        const flawfinderResult = TestUtils.validateFlawfinder(expectedImplPath);
        if (!flawfinderResult.valid) {
          result.error = `flawfinder failed: ${flawfinderResult.message}`;
          cleanupHelpers();
          return result;
        }
      }

      // Step 5: no-warnings check (if marker present)
      if (TestUtils.hasNoWarningsMarker(source)) {
        const noWarningsResult = TestUtils.validateNoWarnings(
          expectedImplPath,
          rootDir,
        );
        if (!noWarningsResult.valid) {
          result.error = `No-warnings check failed: ${noWarningsResult.message}`;
          cleanupHelpers();
          return result;
        }
      }
    }

    // Execute if requested and not ARM-only code
    if (shouldExec && /^\s*\/\/\s*test-execution\s*$/m.test(source)) {
      if (TestUtils.requiresArmRuntime(transpileResult.code)) {
        result.execSuccess = true;
        result.skippedExec = true;
        cleanupHelpers();
        return result;
      }

      const execPath = TestUtils.getExecutablePath(cnxFile);
      const sourceFiles = [expectedImplPath, ...helperImplFiles];

      try {
        // Compile to executable (reuse auto-detected compiler from above)
        const cFileDir = dirname(expectedImplPath);
        execFileSync(
          actualCompiler,
          [
            actualStdFlag,
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

        // Execute
        try {
          execFileSync(execPath, [], {
            encoding: "utf-8",
            timeout: 5000,
            stdio: "pipe",
          });
          result.execSuccess = true;
        } catch (execError: unknown) {
          const err = execError as { status?: number };
          const exitCode = err.status || 1;
          result.error = `${mode.toUpperCase()} execution failed with exit code ${exitCode}`;
          cleanupHelpers();
          return result;
        } finally {
          try {
            if (existsSync(execPath)) unlinkSync(execPath);
          } catch {
            // Ignore cleanup errors
          }
        }
      } catch (compileError: unknown) {
        const err = compileError as { stderr?: string; message: string };
        result.error = `${mode.toUpperCase()} compile for execution failed: ${err.stderr || err.message}`;
        cleanupHelpers();
        return result;
      }
    } else {
      result.execSuccess = true; // No execution requested
    }

    cleanupHelpers();
    return result;
  }

  /**
   * Run a single test file in dual-mode (C and C++)
   *
   * This is the core test runner logic, shared between test.ts (sequential mode)
   * and test-worker.ts (parallel mode).
   *
   * Default behavior: Run BOTH C and C++ modes
   * - `// test-c-only`: Skip C++ mode (MISRA-specific tests)
   * - `// test-cpp-only`: Skip C mode (C++ interop tests)
   * - `// test-no-exec`: Skip execution (compile only)
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
    if (/\/\*\s*test-execution\s*\*\//.test(source)) {
      return {
        passed: false,
        message:
          'Invalid test-execution marker: use "// test-execution" not "/* test-execution */"',
      };
    }

    const basePath = cnxFile.replace(/\.test\.cnx$/, "");
    const expectedErrorFile = basePath + ".expected.error";

    // Determine which modes to run (default: BOTH C and C++)
    const modes = TestUtils.getTestModes(source);
    const shouldExec = !TestUtils.hasNoExecMarker(source);
    const helperCnxFiles = TestUtils.findHelperCnxFiles(cnxFile, source);

    // Error tests: single-mode (transpilation error is mode-independent)
    if (existsSync(expectedErrorFile)) {
      return TestUtils.runErrorTest(
        cnxFile,
        source,
        basePath,
        expectedErrorFile,
        updateMode,
        rootDir,
      );
    }

    // Run each enabled mode (default: both C and C++)
    const modeResults: IModeResult[] = [];
    for (const mode of modes as TTestMode[]) {
      const modeResult = await TestUtils.runTestMode(
        cnxFile,
        source,
        mode,
        updateMode,
        tools,
        rootDir,
        shouldExec,
        helperCnxFiles,
      );
      modeResults.push(modeResult);
    }

    // Aggregate results
    return TestUtils.aggregateModeResults(
      modeResults,
      modes as TTestMode[],
      updateMode,
    );
  }

  /**
   * Run an error test (transpilation should fail)
   * Error tests are mode-independent since transpilation errors happen before code generation
   */
  private static async runErrorTest(
    cnxFile: string,
    source: string,
    basePath: string,
    expectedErrorFile: string,
    updateMode: boolean,
    rootDir: string,
  ): Promise<ITestResult> {
    const expectedCFile = basePath + ".expected.c";
    const expectedHFile = basePath + ".expected.h";
    const headerFile = basePath + ".test.h";

    const expectedErrors = readFileSync(expectedErrorFile, "utf-8").trim();

    // Clean up stale success test artifacts
    for (const staleFile of [expectedCFile, expectedHFile, headerFile]) {
      if (existsSync(staleFile)) {
        try {
          unlinkSync(staleFile);
        } catch {
          // Ignore cleanup errors
        }
      }
    }

    // Transpile to check for errors
    const pipeline = new Transpiler({
      inputs: [],
      includeDirs: [join(rootDir, "tests/include")],
      noCache: true,
    });

    const result = await pipeline.transpileSource(source, {
      workingDir: dirname(cnxFile),
      sourcePath: cnxFile,
    });

    if (result.success) {
      if (updateMode) {
        unlinkSync(expectedErrorFile);
        writeFileSync(expectedCFile, result.code);
        return {
          passed: true,
          message: "Switched from error to C snapshot",
          updated: true,
        };
      }
      return {
        passed: false,
        message: "Expected errors but transpilation succeeded",
        expected: expectedErrors,
        actual: "(no errors)",
      };
    }

    const actualErrors = result.errors
      .map((e) => `${e.line}:${e.column} ${e.message}`)
      .join("\n");

    if (updateMode) {
      writeFileSync(expectedErrorFile, actualErrors + "\n");
      return {
        passed: true,
        message: "Updated error snapshot",
        updated: true,
      };
    }

    if (
      TestUtils.normalize(actualErrors) === TestUtils.normalize(expectedErrors)
    ) {
      return { passed: true };
    }

    return {
      passed: false,
      message: "Error output mismatch",
      expected: expectedErrors,
      actual: actualErrors,
    };
  }

  /**
   * Aggregate results from multiple mode runs into a single ITestResult
   */
  private static aggregateModeResults(
    results: IModeResult[],
    requestedModes: TTestMode[],
    updateMode: boolean,
  ): ITestResult {
    const cResult = results.find((r) => r.mode === "c");
    const cppResult = results.find((r) => r.mode === "cpp");

    // Check if all modes passed
    const allPassed = results.every(
      (r) =>
        r.transpileSuccess &&
        r.snapshotMatch &&
        r.headerMatch &&
        r.compileSuccess &&
        r.execSuccess,
    );

    // Find first failure for error message
    const firstFailure = results.find(
      (r) =>
        !r.transpileSuccess ||
        !r.snapshotMatch ||
        !r.headerMatch ||
        !r.compileSuccess ||
        !r.execSuccess,
    );

    // Check for skipped execution
    const anySkippedExec = results.some((r) => r.skippedExec);

    // Check for missing snapshots (no expected file)
    const noSnapshot = results.every((r) =>
      r.error?.includes("No expected file"),
    );

    const testResult: ITestResult = {
      passed: allPassed,
      cResult,
      cppResult,
      cSkipped: !requestedModes.includes("c"),
      cppSkipped: !requestedModes.includes("cpp"),
      skippedExec: anySkippedExec,
      noSnapshot,
    };

    if (!allPassed && firstFailure) {
      testResult.message = firstFailure.error;
      testResult.expected = firstFailure.expected;
      testResult.actual = firstFailure.actual;
    }

    // In update mode, mark as updated if we created snapshots
    if (updateMode && allPassed && results.length > 0) {
      const modes = results.map((r) => r.mode.toUpperCase()).join("+");
      testResult.updated = true;
      testResult.message = `Updated ${modes} snapshot(s)`;
    }

    return testResult;
  }
}

export default TestUtils;
