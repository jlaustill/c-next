/**
 * Shared Test Utilities
 *
 * Common interfaces and validation functions used by both
 * test.ts (main runner) and test-worker.ts (parallel worker).
 *
 * This module centralizes duplicated code to prevent drift
 * (e.g., validateMisra missing -I flag in one file but not the other).
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  unlinkSync,
  statSync,
  readdirSync,
} from "node:fs";
import { join, dirname, basename } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import ITools from "./types/ITools";
import ITestOptions from "./types/ITestOptions";
import IValidationResult from "./types/IValidationResult";
import ITestResult from "./types/ITestResult";
import type TTestMode from "./types/TTestMode";
import type IModeResult from "./types/ITestMode";
import detectCppSyntax from "../src/transpiler/logic/detectCppSyntax";

// Project root for CLI invocation (this file is in /workspace/scripts/)
const PROJECT_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// Use pre-built bundle when available (eliminates tsx/npx overhead per test)
const DIST_ENTRY = join(PROJECT_ROOT, "dist", "index.js");
const SRC_DIR = join(PROJECT_ROOT, "src");

/**
 * Check if dist/index.js is fresh (newer than all source files in src/).
 * Short-circuits on the first stale file found.
 */
function isDistFresh(): boolean {
  if (!existsSync(DIST_ENTRY)) return false;

  const distMtime = statSync(DIST_ENTRY).mtimeMs;

  function hasNewerSource(dir: string): boolean {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (hasNewerSource(fullPath)) return true;
      } else if (entry.name.endsWith(".ts")) {
        if (statSync(fullPath).mtimeMs > distMtime) return true;
      }
    }
    return false;
  }

  return !hasNewerSource(SRC_DIR);
}

// Auto-rebuild on module load to ensure tests always use fresh bundle.
// Only the main process should rebuild — workers (created via fork()) have
// process.send, so we skip the build check in them to avoid 24 concurrent builds.
if (!process.send && existsSync(DIST_ENTRY) && !isDistFresh()) {
  console.warn("Warning: dist/index.js is stale. Rebuilding...");
  const buildResult = spawnSync("npm", ["run", "build"], {
    cwd: PROJECT_ROOT,
    encoding: "utf-8",
    stdio: "inherit",
  });
  if (buildResult.status !== 0) {
    console.error("Build failed. Falling back to tsx for transpilation.");
    try {
      unlinkSync(DIST_ENTRY);
    } catch {
      /* ignore */
    }
  }
}
const USE_BUILT = existsSync(DIST_ENTRY);

/**
 * Result from CLI transpilation
 */
interface ICliTranspileResult {
  success: boolean;
  code: string;
  headerCode: string;
  errors: Array<{ line: number; column: number; message: string }>;
  stderr: string;
  /**
   * Implementation files the CLI reported writing, as absolute paths.
   *
   * Issue #1314: the harness used to infer the output extension from the mode it
   * ASKED for (`cppMode ? ".cpp" : ".c"`) and only reconsidered when that file was
   * absent. A `.hpp` include makes the transpiler auto-select C++
   * (`Transpiler.detectCppFromFileType`), so in C mode no `.c` is written -- but a
   * stale committed `.c` from an older transpiler satisfied the existence check,
   * so the harness read THAT and compared it to an equally stale `.expected.c`.
   * Both matched, the test passed, and the file under validation was one no
   * transpiler produced. The stale file's existence was what suppressed the
   * detection. Reading the CLI's own report removes the inference entirely.
   */
  generatedImplPaths: string[];
}

/**
 * Transpile a C-Next file using the CLI (not library imports).
 *
 * This ensures tests exercise the exact same code path as real users.
 * Previously tests imported Transpiler directly, which bypassed conflict
 * detection and other CLI-only features.
 *
 * @param cnxFile - Path to the .cnx file to transpile
 * @param _rootDir - Project root directory (unused, kept for API compatibility)
 * @param cppMode - Whether to use C++ mode (--cpp flag)
 * @param outputPath - Optional output path for the generated code file
 */
function transpileViaCli(
  cnxFile: string,
  _rootDir: string,
  cppMode: boolean,
  outputPath?: string,
): ICliTranspileResult {
  // Build CLI args - use PROJECT_ROOT for CLI/includes, but cnxFile is the actual test file path
  // Note: We don't clean up stale files - the CLI overwrites them and they're tracked in git
  const cliArgs = [cnxFile, "--include", join(PROJECT_ROOT, "tests/include")];

  if (cppMode) {
    cliArgs.push("--cpp");
  }

  // Determine output paths
  let codePath: string;
  let headerPath: string;
  const codeExt = cppMode ? ".cpp" : ".c";
  const headerExt = cppMode ? ".hpp" : ".h";

  if (outputPath) {
    cliArgs.push("-o", outputPath);
    codePath = outputPath;
    // Header goes next to the code file with matching extension
    headerPath = outputPath.replace(/\.(c|cpp)$/, headerExt);
  } else {
    const basePath = cnxFile.replace(/\.cnx$/, "");
    codePath = basePath + codeExt;
    headerPath = basePath + headerExt;
  }

  // Run CLI from project root (where src/index.ts exists)
  // Clear VITEST env so the CLI's main() function runs
  // (src/index.ts checks VITEST to skip auto-execution during unit tests)
  const cleanEnv = { ...process.env };
  delete cleanEnv.VITEST;

  // Use pre-built bundle when available (fast), fall back to npx tsx for dev
  const result = USE_BUILT
    ? spawnSync(process.execPath, [DIST_ENTRY, ...cliArgs], {
        cwd: PROJECT_ROOT,
        encoding: "utf-8",
        timeout: 30000,
        env: cleanEnv,
      })
    : spawnSync(
        "npx",
        ["tsx", join(PROJECT_ROOT, "src/index.ts"), ...cliArgs],
        {
          cwd: PROJECT_ROOT,
          encoding: "utf-8",
          timeout: 30000,
          env: cleanEnv,
        },
      );

  // Parse errors from stderr
  // CLI format: "Error: /path/file.cnx:line:column message" followed by optional indented continuation lines
  const errors: Array<{ line: number; column: number; message: string }> = [];
  if (result.stderr) {
    const lines = result.stderr.split("\n");
    let currentError: {
      line: number;
      column: number;
      messageParts: string[];
    } | null = null;

    for (const line of lines) {
      // Skip empty lines and "Compilation failed" message
      if (!line.trim() || line === "Compilation failed") continue;

      // Match: "Error: /path/file.cnx:line:column message"
      const fullMatch = line.match(/^Error:\s*[^:]+:(\d+):(\d+)\s+(.+)$/);
      if (fullMatch) {
        // Save previous error if any
        if (currentError) {
          errors.push({
            line: currentError.line,
            column: currentError.column,
            message: currentError.messageParts.join("\n"),
          });
        }
        currentError = {
          line: parseInt(fullMatch[1], 10),
          column: parseInt(fullMatch[2], 10),
          messageParts: [fullMatch[3]],
        };
        continue;
      }

      // Continuation line (starts with spaces)
      if (currentError && /^\s+/.test(line)) {
        currentError.messageParts.push(line);
        continue;
      }

      // Fallback: simple "line:column message", i.e. a diagnostic with no
      // source path in front of it.
      const simpleMatch = line.match(/^(?:Error:\s*)?(\d+):(\d+)\s+(.+)$/);
      if (simpleMatch) {
        if (currentError) {
          errors.push({
            line: currentError.line,
            column: currentError.column,
            message: currentError.messageParts.join("\n"),
          });
        }
        // #1319: become the current error rather than pushing immediately. This
        // branch used to push and null `currentError`, so the continuation
        // branch above could never fire for a pathless diagnostic and every
        // line after the first was dropped -- silently, since a fixture
        // regenerated under that behavior simply never recorded the guidance.
        // The path-carrying branch has always accumulated; only this one did
        // not, so the same diagnostic asserted more or less of itself depending
        // on whether it happened to know its file.
        currentError = {
          line: parseInt(simpleMatch[1], 10),
          column: parseInt(simpleMatch[2], 10),
          messageParts: [simpleMatch[3]],
        };
      }
    }

    // Don't forget the last error
    if (currentError) {
      errors.push({
        line: currentError.line,
        column: currentError.column,
        message: currentError.messageParts.join("\n"),
      });
    }
  }

  // Read generated files if they exist
  // Handle CLI auto-detection: if we asked for C but got C++ (due to .hpp includes), use C++ paths
  let code = "";
  let headerCode = "";
  let actualCodePath = codePath;
  let actualHeaderPath = headerPath;

  // Issue #1314: the CLI names every file it wrote. Ask it, rather than probing
  // the filesystem for a name we guessed -- a leftover file from an older
  // transpiler answers an existence check just as convincingly as a fresh one.
  const generatedImplPaths = TestUtils.parseGeneratedImplPaths(
    result.stdout || "",
  );

  if (result.status === 0) {
    // Only the CLI's answer for THIS path counts. `generatedImplPaths[0]` would be
    // a second guess and a wrong one: outputFiles is filled impl-by-impl across the
    // whole pipeline (Transpiler._recordFileResult) with headers appended afterwards
    // (_generateAllHeadersFromPipeline), so in a multi-file run [0] is a DEPENDENCY's
    // impl, not the fixture's. Verified -- an entry including dep.cnx prints
    // `dep.c, main.test.c, dep.h`. A miss stays a miss; the caller's guard reports it.
    const reportedImpl = generatedImplPaths.find((p) => p === codePath);
    if (reportedImpl) {
      actualCodePath = reportedImpl;
      actualHeaderPath = reportedImpl
        .replace(/\.cpp$/, ".hpp")
        .replace(/\.c$/, ".h");
    }

    if (existsSync(actualCodePath)) {
      code = readFileSync(actualCodePath, "utf-8");
    }
    if (existsSync(actualHeaderPath)) {
      headerCode = readFileSync(actualHeaderPath, "utf-8");
    }
  }

  return {
    success: result.status === 0,
    code,
    headerCode,
    errors,
    stderr: result.stderr || "",
    generatedImplPaths,
  };
}

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

    // C++ reference parameters in function declarations
    // Pattern 1: const Type& paramName (const reference)
    if (/\bconst\s+\w+\s*&\s*\w+/.test(cCode)) {
      return true;
    }
    // Pattern 2: Type& paramName in function param context
    // Requires: type starts with letter, & follows, param name starts with letter, ends with , or )
    // Uses [a-zA-Z] instead of \w to exclude patterns like "0xFFU & value)" which are bitwise ops
    // NOTE: Intentionally permissive — may match in typedef/macro contexts, which is acceptable
    // since the goal is C++ compiler selection (false positives are harmless, false negatives break builds)
    if (/[a-zA-Z_]\w*\s*&\s*[a-zA-Z_]\w*\s*[,)]/.test(cCode)) {
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

      // Compile with -Werror to treat warnings as errors.
      // Issue #1143: -Wstringop-overflow / -Warray-bounds are middle-end
      // diagnostics produced by value-range propagation, so they need an
      // optimizing compile. The previous "-fsyntax-only" (with no -O) stopped
      // after parsing and could not emit them at all -- a guaranteed 32-byte
      // memcpy into an 8-byte buffer passed silently.
      //
      // -O3 rather than -O2: measured against a known-bad fixture (a clamped
      // offset saturating to UINT32_MAX past a wrapping bounds guard), -O2
      // reports nothing and -O3 reports it. All test-no-warnings fixtures are
      // clean at -O3, so the extra inlining costs no false positives here.
      execFileSync(
        compiler,
        [
          "-c",
          "-o",
          "/dev/null",
          "-O3",
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
   * Issue #1219: ADRs a fixture declares it exercises.
   *
   * Marker form: `// test-adr: 051, 057` -- consistent with the
   * `test-execution` / `test-link:` family, and deliberately NOT the prose
   * `// ADR-051: ...` convention 414 fixtures already use. Prose mentions
   * include references that are not coverage claims
   * (`// NOTE (ADR-063 / #1117): these calls used to be written ...`), so
   * treating them as a contract would over-claim.
   *
   * Intent is the one fact in the matrix that is NOT derivable: a fixture's
   * structure shows that it CONTAINS a division, never that its purpose is
   * proving the division check fires. The cell it occupies stays derived.
   *
   * @returns zero-padded three-digit ADR numbers, deduplicated, in source order
   */
  static findAdrReferences(source: string): string[] {
    const adrRegex: RegExp = /^\s*\/\/\s*test-adr:\s*(.+)$/gim;
    const found: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = adrRegex.exec(source)) !== null) {
      const ids: string[] = match[1]
        .split(",")
        .map((id: string) => id.trim())
        .filter(Boolean);
      for (const id of ids) {
        const digits: RegExpExecArray | null = /^(?:ADR-)?(\d{1,3})$/i.exec(id);
        if (digits === null) continue;
        const normalized: string = digits[1].padStart(3, "0");
        if (!found.includes(normalized)) found.push(normalized);
      }
    }

    return found;
  }

  static findLinkedSourceFiles(testFile: string, source: string): string[] {
    const testDir: string = dirname(testFile);
    const linkedFiles: string[] = [];
    const linkRegex: RegExp = /^\s*\/\/\s*test-link:\s*(.+)$/gim;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(source)) !== null) {
      const files: string[] = match[1].split(/\s+/).filter(Boolean);
      for (const file of files) {
        linkedFiles.push(join(testDir, file));
      }
    }

    return linkedFiles;
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
   * The header a helper `.cnx` generates, in the mode under test.
   */
  private static helperHeaderPath(helperCnx: string, mode: TTestMode): string {
    const ext = mode === "cpp" ? "hpp" : "h";
    return join(dirname(helperCnx), `${basename(helperCnx, ".cnx")}.${ext}`);
  }

  /**
   * Issue #1470: a helper's header is written twice per mode -- once by the
   * entry file's multi-file pipeline run, and again by the single-file run this
   * harness performs on the helper itself, which overwrites it. Only the second
   * reaches the compiler and the working-tree check, so a header the multi-file
   * pipeline gets WRONG is invisible: a single-file run cannot exhibit a
   * cross-file ordering defect, because "the only file is also the last one"
   * (issue #1139, whose regression fixture this silence had made unable to fail).
   *
   * The two must therefore agree. Compared byte-for-byte rather than through
   * `normalize()`: both files are written by the same transpiler in the same
   * pass, so any difference at all is a real divergence and not formatting.
   */
  private static findHelperHeaderDivergence(
    captured: { path: string; content: string | null }[],
    mode: TTestMode,
    rootDir: string,
  ): { error: string; expected: string; actual: string } | null {
    for (const { path, content } of captured) {
      const afterHelperRun = existsSync(path)
        ? readFileSync(path, "utf-8")
        : null;
      if (afterHelperRun === content) {
        continue;
      }

      const shown = path.startsWith(rootDir)
        ? path.slice(rootDir.length + 1)
        : path;
      const absent = "<no header emitted>";
      return {
        error:
          `${mode.toUpperCase()} helper header divergence: ${shown} differs ` +
          `between the multi-file pipeline run and the single-file helper run, ` +
          `so the header this fixture compiles is not the one the pipeline ` +
          `produces. That is a cross-file ordering defect (issue #1470).`,
        expected: content ?? absent,
        actual: afterHelperRun ?? absent,
      };
    }
    return null;
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
   * @param helperCnxFiles - Helper .cnx files to also transpile
   * @param options - Test execution options (transpileOnly)
   */
  static async runTestMode(
    cnxFile: string,
    source: string,
    mode: TTestMode,
    updateMode: boolean,
    tools: ITools,
    rootDir: string,
    helperCnxFiles: string[],
    options: ITestOptions = {},
  ): Promise<IModeResult> {
    const basePath = cnxFile.replace(/\.test\.cnx$/, "");
    const paths = TestUtils.getExpectedPaths(basePath, mode);

    // Initialize result
    const result: IModeResult = {
      mode,
      transpileSuccess: false,
      snapshotMatch: false,
      headerMatch: false,
      compileSuccess: false,
      execSuccess: false,
    };

    // Expected file paths
    const expectedImplPath = paths.expectedImpl;
    const expectedHeaderPath = paths.expectedHeader;

    // Helper implementation files (built up during transpilation)
    let helperImplFiles: string[] = [];

    // Always transpile via CLI: every test is re-transpiled in the same pass
    // that compiles and executes it, so a stale .cnx can never be silently
    // validated against pre-existing generated files (Issue #1018).
    const transpileResult = transpileViaCli(cnxFile, rootDir, mode === "cpp");

    if (!transpileResult.success) {
      const errors = transpileResult.errors
        .map((e) => `${e.line}:${e.column} ${e.message}`)
        .join("\n");
      result.error = `Transpilation failed: ${errors || transpileResult.stderr}`;
      return result;
    }

    result.transpileSuccess = true;

    // Issue #1314: a fixture that includes a `.hpp` makes the transpiler
    // auto-select C++, so a C-mode run writes no `.c` at all. Without this the
    // run silently validates whatever `.c` happens to be lying in the directory
    // -- which is how seven dead snapshots stayed green for months. The fixture
    // is a C++ interop test and must say so.
    // A block that cannot be parsed is a harness fault and must be loud. Skipping the check
    // here would restore exactly #1314: the path falls back to the GUESSED `.c`, the
    // run reads whatever `.c` is on disk, and it goes silently green again. The CLI
    // prints this block unconditionally on the success path (Runner.ts:65 ->
    // ResultPrinter.print), so an empty parse means its format moved, not that it
    // was asked to be quiet -- there is no --quiet flag.
    if (transpileResult.generatedImplPaths.length === 0) {
      result.error =
        "CLI reported no generated output files -- could not parse the " +
        "`Generated N output files:` block. Update " +
        "TestUtils.parseGeneratedImplPaths to match the CLI's output format.";
      return result;
    }

    if (mode === "c") {
      const wroteC = transpileResult.generatedImplPaths.some((implPath) =>
        implPath.endsWith(".c"),
      );
      if (!wroteC) {
        result.error =
          "C mode produced no .c file: the transpiler auto-detected C++ " +
          "(a .hpp include). Mark this fixture `// test-cpp-only` and remove " +
          "its C-side snapshots (.test.c/.test.h/.expected.c/.expected.h).";
        return result;
      }
    }

    // Issue #1470: capture each helper's header as the multi-file pipeline run
    // above left it, BEFORE the single-file runs below overwrite it. See
    // findHelperHeaderDivergence for why the two must agree.
    const helperHeadersFromPipeline = helperCnxFiles.map((helperCnx) => {
      const path = TestUtils.helperHeaderPath(helperCnx, mode);
      return {
        path,
        content: existsSync(path) ? readFileSync(path, "utf-8") : null,
      };
    });

    // Transpile helper files via CLI
    // NOTE: Don't use -o flag here. The CLI's -o flag causes a rename operation
    // that would move tracked helper files to temp locations. Instead, let
    // helpers generate in place (they're tracked in git anyway).
    for (const helperCnx of helperCnxFiles) {
      const helperBaseName = basename(helperCnx, ".cnx");
      const implExt = mode === "cpp" ? "cpp" : "c";

      // The helper file will be generated at the default location
      const helperImplFile = join(
        dirname(helperCnx),
        `${helperBaseName}.${implExt}`,
      );

      // Transpile WITHOUT -o to avoid renaming tracked files
      const helperResult = transpileViaCli(helperCnx, rootDir, mode === "cpp");

      if (helperResult.success) {
        // Same fact, same source: ask the CLI which impl it wrote for this helper
        // rather than re-deriving it from the mode we asked for, three lines from
        // the call that already returns the truth. A helper that includes a `.hpp`
        // auto-switches to C++, and pushing the guessed `helper.c` would hand a
        // stale file to the compiler for test-execution runs -- #1314's exact shape.
        const reported = helperResult.generatedImplPaths.find((implPath) =>
          basename(implPath).startsWith(`${helperBaseName}.`),
        );
        helperImplFiles.push(reported ?? helperImplFile);
      }
    }

    // No cleanup needed - helper files are tracked in git and should persist

    // Issue #1470: checked BEFORE the update branch below. A divergence is a
    // transpiler defect, not a snapshot that needs refreshing, so `--update`
    // must not be able to absorb it -- the same reason #1316 made `--update`
    // fail on a fixture that stops erroring instead of rewriting its snapshot.
    const helperHeaderDivergence = TestUtils.findHelperHeaderDivergence(
      helperHeadersFromPipeline,
      mode,
      rootDir,
    );
    if (helperHeaderDivergence) {
      result.error = helperHeaderDivergence.error;
      result.expected = helperHeaderDivergence.expected;
      result.actual = helperHeaderDivergence.actual;
      return result;
    }

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
      return result;
    }

    // No expected file - skip this mode
    if (!hasExpectedImpl) {
      result.error = `No expected file: ${paths.expectedImpl}`;
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
      return result;
    }
    result.snapshotMatch = true;

    // Compare header snapshot (if headers were generated)
    if (transpileResult.headerCode) {
      if (!hasExpectedHeader) {
        result.error = `Missing ${expectedHeaderPath} - headers were generated but no snapshot exists`;
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
        return result;
      }
    }
    result.headerMatch = true;

    // transpileOnly mode: Skip compilation and execution
    if (options.transpileOnly) {
      result.compileSuccess = true;
      result.execSuccess = true;
      result.skippedExec = true;
      return result;
    }

    // Skip compilation for transpile-only tests (per-file marker)
    const isTranspileOnly = TestUtils.hasTranspileOnlyMarker(source);
    if (isTranspileOnly) {
      result.compileSuccess = true;
      result.execSuccess = true;
      result.skippedExec = true;
      // No cleanup needed for helper files
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
        // No cleanup needed for helper files
        return result;
      }
    } else {
      result.compileSuccess = true; // Skip if no gcc
    }

    // Static analysis (cppcheck, clang-tidy, MISRA, flawfinder) runs as a
    // separate batch step via `npm run validate:c` / scripts/batch-validate.mjs.
    // This avoids paying per-file tool startup costs during integration tests
    // and ensures local + CI behavior are identical.

    // No-warnings check runs inline since it uses the same gcc compiler
    // already available and is fast (syntax-only check)
    if (mode === "c" && TestUtils.hasNoWarningsMarker(source)) {
      const noWarningsResult = TestUtils.validateNoWarnings(
        expectedImplPath,
        rootDir,
      );
      if (!noWarningsResult.valid) {
        result.error = `No-warnings check failed: ${noWarningsResult.message}`;
        // No cleanup needed for helper files
        return result;
      }
    }

    // Execute test-execution tests, unless the generated code needs an ARM runtime
    if (/^\s*\/\/\s*test-execution\s*$/m.test(source)) {
      // Read freshly generated code to check for ARM runtime requirements
      const existingCode = readFileSync(expectedImplPath, "utf-8");
      if (TestUtils.requiresArmRuntime(existingCode)) {
        result.execSuccess = true;
        result.skippedExec = true;
        // No cleanup needed for helper files
        return result;
      }

      const execPath = TestUtils.getExecutablePath(cnxFile);
      const sourceFiles: string[] = [
        expectedImplPath,
        ...helperImplFiles,
        ...TestUtils.findLinkedSourceFiles(cnxFile, source),
      ];

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

        // Execute and capture stdout for parity comparison
        try {
          const stdout = execFileSync(execPath, [], {
            encoding: "utf-8",
            timeout: 5000,
            stdio: "pipe",
          });
          result.execSuccess = true;
          result.stdout = stdout; // Capture for parity comparison
        } catch (execError: unknown) {
          const err = execError as { status?: number; stdout?: string };
          const exitCode = err.status || 1;
          result.error = `${mode.toUpperCase()} execution failed with exit code ${exitCode}`;
          result.stdout = err.stdout; // Capture stdout even on failure
          // No cleanup needed for helper files
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
        // No cleanup needed for helper files
        return result;
      }
    } else {
      result.execSuccess = true; // No execution requested
    }

    // No cleanup needed for helper files
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
   *
   * @param cnxFile - Path to the .test.cnx file
   * @param updateMode - Whether to update snapshots
   * @param tools - Available validation tools
   * @param rootDir - Project root directory
   * @param options - Test execution options (transpileOnly)
   */
  static async runTest(
    cnxFile: string,
    updateMode: boolean,
    tools: ITools,
    rootDir: string,
    options: ITestOptions = {},
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
    const helperCnxFiles = TestUtils.findHelperCnxFiles(cnxFile, source);

    // Error tests: single-mode, but NOT mode-independent any more. #1319 made
    // "does this run emit C++?" a declared fact with its own diagnostic
    // (E0507), so a fixture whose error needs a C++ context must be run in C++
    // mode or it reports E0507 instead of the error it asserts. The mode marker
    // is what says which, so it is honoured here rather than assumed to be C.
    if (existsSync(expectedErrorFile)) {
      // Guard: test-error cases must not have committed .test.* artifacts
      const staleArtifactCheck =
        TestUtils.checkForStaleErrorTestArtifacts(basePath);
      if (staleArtifactCheck) {
        return staleArtifactCheck;
      }

      return TestUtils.runErrorTest(
        cnxFile,
        basePath,
        expectedErrorFile,
        updateMode,
        rootDir,
        (modes as TTestMode[]).includes("cpp") &&
          !(modes as TTestMode[]).includes("c"),
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
        helperCnxFiles,
        options,
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
   * What a test-error fixture's generated output consists of.
   *
   * Read by the stale-artifact guard and by the `--update` cleanup below, so
   * "which files does a test-error fixture produce?" is answered in one place.
   */
  private static readonly ERROR_TEST_ARTIFACT_EXTENSIONS = [
    "test.c",
    "test.cpp",
    "test.h",
    "test.hpp",
  ];

  /**
   * Check if a test-error case has stale .test.* artifacts committed
   *
   * A test-error case stops at the expected compile error and emits no generated
   * output, so any committed .test.c/.test.cpp/.test.h/.test.hpp is stale by
   * definition and actively misleading (shows successful compile of failing code).
   *
   * @returns ITestResult with failure if stale artifacts found, null otherwise
   */
  static checkForStaleErrorTestArtifacts(basePath: string): ITestResult | null {
    const staleFiles: string[] = [];

    for (const ext of TestUtils.ERROR_TEST_ARTIFACT_EXTENSIONS) {
      const artifactPath = `${basePath}.${ext}`;
      if (existsSync(artifactPath)) {
        staleFiles.push(artifactPath);
      }
    }

    if (staleFiles.length > 0) {
      const fileList = staleFiles.map((f) => basename(f)).join(", ");
      return {
        passed: false,
        message: `test-error case has stale generated artifacts: ${fileList}`,
        expected: "(no .test.c/.test.cpp/.test.h/.test.hpp files)",
        actual: `Found: ${fileList}\nRun: git rm ${staleFiles.join(" ")}`,
      };
    }

    return null;
  }

  /**
   * Implementation files (`.c` / `.cpp`) named in the CLI's "Generated N output
   * files:" block.
   *
   * Issue #1314: the harness used to infer the output extension from the mode it
   * ASKED for and only reconsidered when that file was absent, so a stale
   * committed `.c` satisfied the check and the run validated a file no
   * transpiler had written. Reading the CLI's own report removes the inference.
   *
   * Headers are excluded deliberately -- callers derive the header path from the
   * implementation path so the two cannot disagree. The block therefore ends at the
   * first non-implementation line: the CLI emits every impl before any header
   * (impl-by-impl in the transpile loop, headers appended afterwards), so an
   * interleaved `a.c, a.h, b.c` cannot occur and tolerating it would be a branch
   * defended only by input the CLI cannot produce.
   */
  static parseGeneratedImplPaths(stdout: string): string[] {
    const paths: string[] = [];
    let inBlock = false;
    for (const line of stdout.split("\n")) {
      if (/^Generated \d+ output files?:/.test(line)) {
        inBlock = true;
        continue;
      }
      if (!inBlock) continue;
      const match = /^\s+(\S.*\.(?:c|cpp))$/.exec(line);
      if (!match) break;
      paths.push(match[1]);
    }
    return paths;
  }

  /**
   * Run an error test (transpilation should fail)
   * Error tests are mode-independent since transpilation errors happen before code generation
   */
  private static async runErrorTest(
    cnxFile: string,
    basePath: string,
    expectedErrorFile: string,
    updateMode: boolean,
    rootDir: string,
    cppMode: boolean,
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

    // Transpile via CLI to check for errors. #1319: in the fixture's declared
    // mode -- a `// test-cpp-only` error fixture asserts an error that only
    // exists in C++, and running it as C now reports E0507 instead.
    const result = transpileViaCli(cnxFile, rootDir, cppMode);

    if (result.success) {
      // Issue #1316: --update must not resolve "a diagnostic was dropped" in
      // favour of "this fixture was always meant to succeed". Unlinking the
      // .expected.error erased the only assertion that the diagnostic fires and
      // reported the run green, so a regression and an intentional fix were
      // indistinguishable -- across 287 error fixtures, on the one command a
      // diagnostic migration runs repeatedly. The snapshot is still written so
      // an author who meant to remove the diagnostic can see the new output;
      // removing the assertion stays their explicit act, made by deleting the
      // .expected.error and its docs/diagnostic-manifest.md row in the same commit.
      if (updateMode) {
        writeFileSync(expectedCFile, result.code);
        // Keeping the .expected.error means transpileViaCli's own output stays
        // on disk, so the stale-artifact guard would fire first on the next run
        // and report "git rm" for files this run just wrote -- masking the
        // message above with an unrelated one, on the re-run an author reaches
        // for immediately. These are this run's output, not committed artifacts.
        for (const ext of TestUtils.ERROR_TEST_ARTIFACT_EXTENSIONS) {
          const artifactPath = `${basePath}.${ext}`;
          if (existsSync(artifactPath)) {
            try {
              unlinkSync(artifactPath);
            } catch {
              // Ignore cleanup errors
            }
          }
        }
      }
      return {
        passed: false,
        message: updateMode
          ? `test-error fixture no longer errors: .expected.error kept, wrote ${basename(expectedCFile)} for inspection. If intentional, delete the .expected.error and its docs/diagnostic-manifest.md row in the same commit.`
          : "Expected errors but transpilation succeeded",
        expected: expectedErrors,
        actual: "(no errors)",
      };
    }

    const actualErrors = result.errors
      .map(
        (e: { line: number; column: number; message: string }) =>
          `${e.line}:${e.column} ${e.message}`,
      )
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

    // Parity check: compare stdout between C and C++ modes (Issue #922)
    // Only check if both modes ran, both executed (not skipped), and both passed
    if (
      cResult &&
      cppResult &&
      cResult.execSuccess &&
      cppResult.execSuccess &&
      !cResult.skippedExec &&
      !cppResult.skippedExec
    ) {
      testResult.parityChecked = true;

      // Normalize stdout for comparison (handle undefined as empty string)
      const cStdout = TestUtils.normalize(cResult.stdout || "");
      const cppStdout = TestUtils.normalize(cppResult.stdout || "");

      if (cStdout === cppStdout) {
        testResult.parityPassed = true;
      } else {
        // Parity mismatch - hard failure
        testResult.parityPassed = false;
        testResult.passed = false;
        testResult.parityError = TestUtils.formatParityError(
          cStdout,
          cppStdout,
        );
        testResult.message = "Parity mismatch: C and C++ outputs differ";
      }
    }

    return testResult;
  }

  /**
   * Format a parity error message showing the differences between C and C++ output
   */
  private static formatParityError(cStdout: string, cppStdout: string): string {
    const cLines = cStdout.split("\n");
    const cppLines = cppStdout.split("\n");
    const maxLines = Math.max(cLines.length, cppLines.length);

    const differences: string[] = [];
    for (let i = 0; i < maxLines; i++) {
      const cLine = cLines[i] ?? "(no line)";
      const cppLine = cppLines[i] ?? "(no line)";
      if (cLine !== cppLine) {
        differences.push(`Line ${i + 1}:`);
        differences.push(`  C:   ${cLine}`);
        differences.push(`  C++: ${cppLine}`);
      }
    }

    return (
      differences.slice(0, 15).join("\n") +
      (differences.length > 15
        ? `\n... and ${differences.length - 15} more differences`
        : "")
    );
  }
}

export default TestUtils;
