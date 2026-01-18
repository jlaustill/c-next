#!/usr/bin/env tsx
/**
 * C-Next Integration Test Runner
 *
 * Comprehensive testing for transpiler output:
 * - Finds all .test.cnx test files (helpers without .test are skipped)
 * - Transpiles each file
 * - Compares output to .expected.c file (if exists)
 * - For error tests, compares to .expected.error file
 * - ALWAYS validates generated C:
 *   1. GCC compilation check
 *   2. Cppcheck static analysis
 *   3. Clang-tidy analysis
 *   4. MISRA C compliance check
 *   5. Execution test (if test-execution marker present)
 *
 * Execution testing:
 * - Add test-execution comment at top of .cnx file to enable
 * - Test must return 0 for success, non-zero for failure
 * - ARM tests (using LDREX/STREX/PRIMASK) auto-skip execution
 *
 * Usage:
 *   npm test                              # Run all tests with full validation (parallel)
 *   npm test -- --update                  # Update snapshots
 *   npm test -- --quiet                   # Minimal output (errors + summary only)
 *   npm test -- --jobs 4                  # Run with 4 parallel workers
 *   npm test -- --jobs 1                  # Run sequentially (no parallelism)
 *   npm test -- tests/enum                # Run specific directory
 *   npm test -- tests/enum/my.test.cnx    # Run single test file
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";
import { execFileSync, fork, ChildProcess } from "child_process";
import { tmpdir, cpus } from "os";
import { randomBytes } from "crypto";
import Pipeline from "../src/pipeline/Pipeline";
import IFileResult from "../src/pipeline/types/IFileResult";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

// ANSI colors for terminal output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

interface ITools {
  gcc: boolean;
  cppcheck: boolean;
  clangTidy: boolean;
  misra: boolean;
}

interface ITestResult {
  passed: boolean;
  message?: string;
  expected?: string;
  actual?: string;
  updated?: boolean;
  skippedExec?: boolean;
  noSnapshot?: boolean;
  execError?: string;
  warningError?: string;
}

/**
 * Check if source has test-no-warnings marker in block comment
 */
function hasNoWarningsMarker(source: string): boolean {
  return /\/\*\s*test-no-warnings\s*\*\//i.test(source);
}

interface IValidationResult {
  valid: boolean;
  message?: string;
}

interface IWorkerResult {
  type: "result" | "ready" | "loaded";
  cnxFile?: string;
  result?: ITestResult;
}

/**
 * Find all .test.cnx files recursively in a directory
 */
function findCnxFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...findCnxFiles(fullPath));
    } else if (entry.endsWith(".test.cnx")) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Normalize output for comparison (trim trailing whitespace, normalize line endings)
 */
function normalize(str: string): string {
  return str
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

/**
 * Detect if a C file includes headers with C++14 features
 * Checks for typed enums (enum Foo : type {) which require C++14 parser
 */
function requiresCpp14(cFile: string): boolean {
  try {
    const cCode = readFileSync(cFile, "utf-8");
    const cFileDir = dirname(cFile);

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
 */
function validateCompilation(cFile: string): IValidationResult {
  try {
    // Auto-detect C++14 headers and use g++ when needed
    const useCpp = requiresCpp14(cFile);
    const compiler = useCpp ? "g++" : "gcc";
    const stdFlag = useCpp ? "-std=c++14" : "-std=c99";

    // Use compiler to check syntax only (no object file generated)
    // Suppress warnings about unused variables and void main (common in tests)
    // -I tests/include for stub headers (e.g., cmsis_gcc.h for ARM intrinsics)
    execFileSync(
      compiler,
      [
        "-fsyntax-only",
        stdFlag,
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
    const err = error as { stderr?: string; stdout?: string; message: string };
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
 */
function validateCppcheck(cFile: string): IValidationResult {
  try {
    execFileSync(
      "cppcheck",
      [
        "--error-exitcode=1",
        "--enable=warning,performance",
        "--suppress=unusedFunction",
        "--suppress=missingIncludeSystem",
        "--suppress=unusedVariable",
        "--quiet",
        cFile,
      ],
      { encoding: "utf-8", timeout: 90000, stdio: "pipe" },
    );
    return { valid: true };
  } catch (error: unknown) {
    const err = error as { stderr?: string; stdout?: string; message: string };
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
 */
function validateClangTidy(cFile: string): IValidationResult {
  try {
    // Run clang-tidy with safety and readability checks
    execFileSync(
      "clang-tidy",
      [cFile, "--", "-std=c99", "-Wno-unused-variable"],
      { encoding: "utf-8", timeout: 30000, stdio: "pipe" },
    );
    return { valid: true };
  } catch (error: unknown) {
    const err = error as { stderr?: string; stdout?: string; message: string };
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
 */
function validateMisra(cFile: string): IValidationResult {
  try {
    // Run cppcheck with MISRA addon
    execFileSync(
      "cppcheck",
      [
        "--addon=misra",
        "--error-exitcode=1",
        "--suppress=missingIncludeSystem",
        "--suppress=unusedFunction",
        "--quiet",
        cFile,
      ],
      { encoding: "utf-8", timeout: 60000, stdio: "pipe" },
    );
    return { valid: true };
  } catch (error: unknown) {
    const err = error as { stderr?: string; stdout?: string; message: string };
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
 * Validate that a C file compiles without any warnings
 * Uses gcc with -Werror to treat all warnings as errors
 */
function validateNoWarnings(cFile: string): IValidationResult {
  try {
    // Auto-detect C++14 headers and use g++ when needed
    const useCpp = requiresCpp14(cFile);
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
    const err = error as { stderr?: string; stdout?: string; message: string };
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
 * Get a unique path for a test executable in the temp directory
 */
function getExecutablePath(cnxFile: string): string {
  const testName = basename(cnxFile, ".test.cnx");
  const uniqueId = randomBytes(4).toString("hex");
  return join(tmpdir(), `cnx-test-${testName}-${uniqueId}`);
}

/**
 * Check if generated C code requires ARM runtime (can't execute on x86)
 */
function requiresArmRuntime(cCode: string): boolean {
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
 * Compile and execute a C file, validating exit code
 */
function executeTest(
  cFile: string,
  expectedExitCode: number = 0,
): IValidationResult {
  const execPath = getExecutablePath(cFile);

  // Auto-detect C++14 headers and use g++ when needed
  const useCpp = requiresCpp14(cFile);
  const compiler = useCpp ? "g++" : "gcc";
  const stdFlag = useCpp ? "-std=c++14" : "-std=c99";

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
        "-o",
        execPath,
        cFile,
      ],
      { encoding: "utf-8", timeout: 30000, stdio: "pipe" },
    );

    // Execute the compiled program
    try {
      execFileSync(execPath, [], {
        encoding: "utf-8",
        timeout: 5000,
        stdio: "pipe",
      });

      // Program exited with 0
      if (expectedExitCode !== 0) {
        return {
          valid: false,
          message: `Expected exit ${expectedExitCode}, got 0`,
        };
      }
      return { valid: true };
    } catch (execError: unknown) {
      const err = execError as { status?: number };
      const actualCode = err.status || 1;

      if (actualCode === expectedExitCode) {
        return { valid: true };
      }

      return {
        valid: false,
        message: `Expected exit 0, got ${actualCode}`,
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
 * Check if validation tools are available
 */
function checkValidationTools(): ITools {
  const tools: ITools = {
    gcc: false,
    cppcheck: false,
    clangTidy: false,
    misra: false,
  };

  try {
    execFileSync("gcc", ["--version"], { encoding: "utf-8", stdio: "pipe" });
    tools.gcc = true;
  } catch {
    // gcc not available
  }

  try {
    execFileSync("cppcheck", ["--version"], {
      encoding: "utf-8",
      stdio: "pipe",
    });
    tools.cppcheck = true;
    // MISRA addon requires cppcheck
    tools.misra = true;
  } catch {
    // cppcheck not available
  }

  try {
    execFileSync("clang-tidy", ["--version"], {
      encoding: "utf-8",
      stdio: "pipe",
    });
    tools.clangTidy = true;
  } catch {
    // clang-tidy not available
  }

  return tools;
}

/**
 * Run a single test (sequential mode)
 * Always validates: transpile -> snapshot match -> gcc -> cppcheck -> clang-tidy -> MISRA
 */
async function runTest(
  cnxFile: string,
  updateMode: boolean,
  tools: ITools,
): Promise<ITestResult> {
  const source = readFileSync(cnxFile, "utf-8");
  const basePath = cnxFile.replace(/\.test\.cnx$/, "");
  const expectedCFile = basePath + ".expected.c";
  const expectedErrorFile = basePath + ".expected.error";
  const headerFile = basePath + ".test.h";

  // Issue #230: If test has a corresponding .test.h file, enable self-include generation
  const hasHeaderFile = existsSync(headerFile);

  // Use Pipeline for transpilation with header parsing support
  const pipeline = new Pipeline({
    inputs: [],
    includeDirs: [join(rootDir, "tests/include")],
    noCache: false,
  });

  const result: IFileResult = await pipeline.transpileSource(source, {
    workingDir: dirname(cnxFile),
    sourcePath: cnxFile,
    generateHeaders: hasHeaderFile, // Issue #230: Enable self-include for extern "C" tests
  });

  // Check if this is an error test (no validation needed for error tests)
  if (existsSync(expectedErrorFile)) {
    const expectedErrors = readFileSync(expectedErrorFile, "utf-8").trim();

    if (result.success) {
      // In update mode, switch from error test to success test
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
      return { passed: true, message: "Updated error snapshot", updated: true };
    }

    if (normalize(actualErrors) === normalize(expectedErrors)) {
      return { passed: true };
    }

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
        return {
          passed: true,
          message: "Switched from C to error snapshot",
          updated: true,
        };
      }
      return {
        passed: false,
        message: `Transpilation failed unexpectedly`,
        expected: "(success)",
        actual: errors,
      };
    }

    if (updateMode) {
      writeFileSync(expectedCFile, result.code);
      return { passed: true, message: "Updated C snapshot", updated: true };
    }

    if (normalize(result.code) === normalize(expectedC)) {
      // Snapshot matches - now run all validation steps

      // Step 1: GCC compilation
      if (tools.gcc) {
        const compileResult = validateCompilation(expectedCFile);
        if (!compileResult.valid) {
          return {
            passed: false,
            message: "GCC compilation failed",
            actual: compileResult.message,
          };
        }
      }

      // Step 2: Cppcheck static analysis
      if (tools.cppcheck) {
        const cppcheckResult = validateCppcheck(expectedCFile);
        if (!cppcheckResult.valid) {
          return {
            passed: false,
            message: "Cppcheck failed",
            actual: cppcheckResult.message,
          };
        }
      }

      // Step 3: Clang-tidy analysis
      if (tools.clangTidy) {
        const clangTidyResult = validateClangTidy(expectedCFile);
        if (!clangTidyResult.valid) {
          return {
            passed: false,
            message: "Clang-tidy failed",
            actual: clangTidyResult.message,
          };
        }
      }

      // Step 4: MISRA compliance check
      if (tools.misra) {
        const misraResult = validateMisra(expectedCFile);
        if (!misraResult.valid) {
          return {
            passed: false,
            message: "MISRA check failed",
            actual: misraResult.message,
          };
        }
      }

      // Step 5: No-warnings check (if /* test-no-warnings */ marker present)
      if (hasNoWarningsMarker(source)) {
        const noWarningsResult = validateNoWarnings(expectedCFile);
        if (!noWarningsResult.valid) {
          return {
            passed: false,
            message: "Warning check failed (test-no-warnings)",
            warningError: noWarningsResult.message,
          };
        }
      }

      // Step 6: Execution test (if // test-execution marker present)
      if (/^\s*\/\/\s*test-execution\s*$/m.test(source)) {
        if (requiresArmRuntime(result.code)) {
          return { passed: true, skippedExec: true };
        }

        const execResult = executeTest(expectedCFile, 0);
        if (!execResult.valid) {
          return {
            passed: false,
            message: "Execution failed",
            actual: execResult.message,
          };
        }
      }

      return { passed: true };
    }

    // Snapshot mismatch - but still try to execute if marker present
    if (/^\s*\/\/\s*test-execution\s*$/m.test(source)) {
      // Write transpiled code to temp file for execution
      const tempCFile = expectedCFile.replace(".expected.c", ".tmp.c");
      writeFileSync(tempCFile, result.code);

      try {
        if (!requiresArmRuntime(result.code)) {
          const execResult = executeTest(tempCFile, 0);
          if (!execResult.valid) {
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
      }
    }

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
      return { passed: true, message: "Created C snapshot", updated: true };
    } else {
      const errors = result.errors
        .map((e) => `${e.line}:${e.column} ${e.message}`)
        .join("\n");
      writeFileSync(expectedErrorFile, errors + "\n");
      return { passed: true, message: "Created error snapshot", updated: true };
    }
  }

  // No expected file and not in update mode
  return {
    passed: false,
    message: "No expected file found. Run with --update to create snapshot.",
    noSnapshot: true,
  };
}

/**
 * Print a test result
 */
function printResult(
  relativePath: string,
  result: ITestResult,
  quietMode: boolean,
): void {
  if (result.passed) {
    if (result.updated) {
      if (!quietMode) {
        console.log(`${colors.yellow}UPDATED${colors.reset} ${relativePath}`);
      }
    } else if (result.skippedExec) {
      if (!quietMode) {
        console.log(
          `${colors.green}PASS${colors.reset}    ${relativePath} ${colors.dim}(exec skipped: ARM)${colors.reset}`,
        );
      }
    } else {
      if (!quietMode) {
        console.log(`${colors.green}PASS${colors.reset}    ${relativePath}`);
      }
    }
  } else {
    if (result.noSnapshot) {
      console.log(
        `${colors.yellow}SKIP${colors.reset}    ${relativePath} (no snapshot)`,
      );
    } else {
      console.log(`${colors.red}FAIL${colors.reset}    ${relativePath}`);
      console.log(`        ${colors.dim}${result.message}${colors.reset}`);
      if (result.expected && result.actual) {
        console.log(`        ${colors.dim}Expected:${colors.reset}`);
        console.log(
          `        ${result.expected.split("\n").slice(0, 5).join("\n        ")}`,
        );
        console.log(`        ${colors.dim}Actual:${colors.reset}`);
        console.log(
          `        ${result.actual.split("\n").slice(0, 5).join("\n        ")}`,
        );
      } else if (result.actual) {
        // Just actual (no expected) - for compilation/analysis errors
        console.log(
          `        ${result.actual.split("\n").slice(0, 5).join("\n        ")}`,
        );
      }
      // Show execution error if present
      if (result.execError) {
        console.log(
          `        ${colors.red}Exec error:${colors.reset} ${result.execError}`,
        );
      }
      // Show warning error if present (test-no-warnings failure)
      if (result.warningError) {
        console.log(
          `        ${colors.red}Warning:${colors.reset} ${result.warningError}`,
        );
      }
    }
  }
}

/**
 * Run tests in parallel using child process fork
 */
async function runTestsParallel(
  cnxFiles: string[],
  updateMode: boolean,
  quietMode: boolean,
  tools: ITools,
  numWorkers: number,
): Promise<{
  passed: number;
  failed: number;
  updated: number;
  noSnapshot: number;
}> {
  return new Promise((resolve) => {
    let passed = 0;
    let failed = 0;
    let updated = 0;
    let noSnapshot = 0;

    const pendingTests = [...cnxFiles];
    const activeWorkers = new Map<ChildProcess, string>();
    let completedCount = 0;

    // Results are stored and printed in order for consistent output
    const results = new Map<string, ITestResult>();
    let nextToPrint = 0;

    const workerPath = join(__dirname, "test-worker.ts");

    function tryPrintResults(): void {
      // Print results in order as they become available
      while (
        nextToPrint < cnxFiles.length &&
        results.has(cnxFiles[nextToPrint])
      ) {
        const cnxFile = cnxFiles[nextToPrint];
        const result = results.get(cnxFile)!;
        const relativePath = cnxFile.replace(rootDir + "/", "");

        printResult(relativePath, result, quietMode);

        if (result.passed) {
          if (result.updated) {
            updated++;
          }
          passed++;
        } else {
          if (result.noSnapshot) {
            noSnapshot++;
          }
          failed++;
        }

        nextToPrint++;
      }
    }

    function createWorker(): ChildProcess {
      // Fork using tsx to run TypeScript worker
      const worker = fork(workerPath, [], {
        execArgv: ["--import", "tsx"],
        stdio: ["pipe", "pipe", "pipe", "ipc"],
      });

      worker.on("message", (message: IWorkerResult) => {
        if (message.type === "loaded") {
          // Worker is loaded, send init message
          worker.send({ type: "init", rootDir, tools });
        } else if (message.type === "ready") {
          // Worker is initialized, assign work
          assignWork(worker);
        } else if (
          message.type === "result" &&
          message.cnxFile &&
          message.result
        ) {
          // Store result
          results.set(message.cnxFile, message.result);
          activeWorkers.delete(worker);
          completedCount++;

          // Try to print results in order
          tryPrintResults();

          // Check if done
          if (completedCount === cnxFiles.length) {
            // Terminate all workers
            workers.forEach((w) => w.send({ type: "exit" }));
            resolve({ passed, failed, updated, noSnapshot });
          } else {
            // Assign more work
            assignWork(worker);
          }
        }
      });

      worker.on("error", (error) => {
        const cnxFile = activeWorkers.get(worker);
        if (cnxFile) {
          results.set(cnxFile, {
            passed: false,
            message: `Worker error: ${error.message}`,
          });
          completedCount++;
          tryPrintResults();
        }
        activeWorkers.delete(worker);

        // Replace crashed worker if there's more work
        if (pendingTests.length > 0) {
          const newWorker = createWorker();
          workers.push(newWorker);
        }

        if (completedCount === cnxFiles.length) {
          workers.forEach((w) => {
            try {
              w.send({ type: "exit" });
            } catch {
              // Worker may already be terminated
            }
          });
          resolve({ passed, failed, updated, noSnapshot });
        }
      });

      worker.on("exit", (code) => {
        // Handle unexpected exit
        const cnxFile = activeWorkers.get(worker);
        if (cnxFile && !results.has(cnxFile)) {
          results.set(cnxFile, {
            passed: false,
            message: `Worker exited unexpectedly with code ${code}`,
          });
          completedCount++;
          tryPrintResults();
        }
        activeWorkers.delete(worker);

        if (completedCount === cnxFiles.length) {
          resolve({ passed, failed, updated, noSnapshot });
        }
      });

      return worker;
    }

    function assignWork(worker: ChildProcess): void {
      if (pendingTests.length > 0) {
        const cnxFile = pendingTests.shift()!;
        activeWorkers.set(worker, cnxFile);
        worker.send({ type: "test", cnxFile, updateMode });
      }
    }

    // Create worker pool
    const workers: ChildProcess[] = [];
    const actualWorkers = Math.min(numWorkers, cnxFiles.length);
    for (let i = 0; i < actualWorkers; i++) {
      workers.push(createWorker());
    }
  });
}

/**
 * Run tests sequentially (original behavior)
 */
async function runTestsSequential(
  cnxFiles: string[],
  updateMode: boolean,
  quietMode: boolean,
  tools: ITools,
): Promise<{
  passed: number;
  failed: number;
  updated: number;
  noSnapshot: number;
}> {
  let passed = 0;
  let failed = 0;
  let updated = 0;
  let noSnapshot = 0;

  for (const cnxFile of cnxFiles) {
    const relativePath = cnxFile.replace(rootDir + "/", "");
    const result = await runTest(cnxFile, updateMode, tools);

    printResult(relativePath, result, quietMode);

    if (result.passed) {
      if (result.updated) {
        updated++;
      }
      passed++;
    } else {
      if (result.noSnapshot) {
        noSnapshot++;
      }
      failed++;
    }
  }

  return { passed, failed, updated, noSnapshot };
}

/**
 * Main test runner
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const updateMode = args.includes("--update") || args.includes("-u");
  const quietMode = args.includes("--quiet") || args.includes("-q");

  // Parse --jobs argument
  let numJobs = cpus().length; // Default to CPU count
  const jobsIndex = args.findIndex((arg) => arg === "--jobs" || arg === "-j");
  if (jobsIndex !== -1 && args[jobsIndex + 1]) {
    const parsed = parseInt(args[jobsIndex + 1], 10);
    if (!isNaN(parsed) && parsed > 0) {
      numJobs = parsed;
    }
  }

  const filterPath = args.find(
    (arg) =>
      !arg.startsWith("-") && (jobsIndex === -1 || arg !== args[jobsIndex + 1]), // Exclude the number after --jobs
  );

  // Determine test path (file or directory)
  let testPath = join(rootDir, "tests");
  if (filterPath) {
    testPath = filterPath.startsWith("/")
      ? filterPath
      : join(rootDir, filterPath);
  }

  // Check if path exists and determine if it's a file or directory
  if (!existsSync(testPath)) {
    console.error(
      `${colors.red}Error: Test path not found: ${testPath}${colors.reset}`,
    );
    process.exit(1);
  }

  const pathStat = statSync(testPath);
  const isSingleFile = pathStat.isFile();

  // Validate single file has correct extension
  if (isSingleFile && !testPath.endsWith(".test.cnx")) {
    console.error(
      `${colors.red}Error: Test file must end with .test.cnx: ${testPath}${colors.reset}`,
    );
    process.exit(1);
  }

  // Always check for validation tools (validation is mandatory)
  const tools = checkValidationTools();

  // Require at least GCC for compilation check
  if (!tools.gcc) {
    console.error(
      `${colors.red}Error: gcc is required for C compilation validation${colors.reset}`,
    );
    process.exit(1);
  }

  if (!quietMode) {
    console.log(`${colors.cyan}C-Next Integration Tests${colors.reset}`);
    console.log(
      `${colors.dim}Test ${isSingleFile ? "file" : "directory"}: ${testPath}${colors.reset}`,
    );
    if (updateMode) {
      console.log(
        `${colors.yellow}Update mode: snapshots will be created/updated${colors.reset}`,
      );
    }

    // Show available validation tools
    const toolList: string[] = [];
    if (tools.gcc) toolList.push("gcc");
    if (tools.cppcheck) toolList.push("cppcheck");
    if (tools.clangTidy) toolList.push("clang-tidy");
    if (tools.misra) toolList.push("MISRA");
    console.log(
      `${colors.cyan}Validation: ${toolList.join(" → ")}${colors.reset}`,
    );

    // Show parallelism info
    if (numJobs > 1) {
      console.log(`${colors.cyan}Workers: ${numJobs} parallel${colors.reset}`);
    } else {
      console.log(`${colors.dim}Mode: sequential${colors.reset}`);
    }
    console.log();
  }

  // Discover test files: single file or recursive directory scan
  const cnxFiles = isSingleFile ? [testPath] : findCnxFiles(testPath);

  if (cnxFiles.length === 0) {
    console.log(`${colors.yellow}No .test.cnx test files found${colors.reset}`);
    process.exit(0);
  }

  // Run tests (parallel or sequential)
  let results: {
    passed: number;
    failed: number;
    updated: number;
    noSnapshot: number;
  };

  if (numJobs > 1 && cnxFiles.length > 1) {
    results = await runTestsParallel(
      cnxFiles,
      updateMode,
      quietMode,
      tools,
      numJobs,
    );
  } else {
    results = await runTestsSequential(cnxFiles, updateMode, quietMode, tools);
  }

  const { passed, failed, updated, noSnapshot } = results;

  if (quietMode) {
    // Single-line summary for AI-friendly output
    if (failed > 0) {
      console.log(
        `${passed}/${cnxFiles.length} tests passed, ${colors.red}${failed} failed${colors.reset}`,
      );
    } else {
      console.log(
        `${colors.green}${cnxFiles.length}/${cnxFiles.length} tests passed${colors.reset}`,
      );
    }
  } else {
    console.log();
    console.log(`${colors.cyan}Results:${colors.reset}`);
    console.log(`  ${colors.green}Passed:${colors.reset}  ${passed}`);
    if (failed > 0) {
      console.log(`  ${colors.red}Failed:${colors.reset}  ${failed}`);
    }
    if (updated > 0) {
      console.log(`  ${colors.yellow}Updated:${colors.reset} ${updated}`);
    }
    if (noSnapshot > 0) {
      console.log(
        `  ${colors.yellow}Skipped:${colors.reset} ${noSnapshot} (no snapshot)`,
      );
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();

export default main;
