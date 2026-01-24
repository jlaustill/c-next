/**
 * Shared Test Utilities
 *
 * Common interfaces and validation functions used by both
 * test.ts (main runner) and test-worker.ts (parallel worker).
 *
 * This module centralizes duplicated code to prevent drift
 * (e.g., validateMisra missing -I flag in one file but not the other).
 */

import { readFileSync, existsSync, unlinkSync } from "fs";
import { join, dirname, basename } from "path";
import { execFileSync } from "child_process";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import ITools from "./types/ITools";
import IValidationResult from "./types/IValidationResult";

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
}

export default TestUtils;
