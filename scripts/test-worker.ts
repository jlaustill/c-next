/**
 * Test Worker - Runs individual tests for parallel execution
 *
 * This worker receives test file paths via IPC and executes them,
 * returning results to the main process.
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { join, basename } from "path";
import { execFileSync } from "child_process";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import transpile from "../src/lib/transpiler";

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
}

interface IValidationResult {
  valid: boolean;
  message?: string;
}

interface IInitMessage {
  type: "init";
  rootDir: string;
  tools: ITools;
}

interface ITestMessage {
  type: "test";
  cnxFile: string;
  updateMode: boolean;
}

interface IExitMessage {
  type: "exit";
}

type TWorkerMessage = IInitMessage | ITestMessage | IExitMessage;

let rootDir: string;
let tools: ITools;

/**
 * Normalize output for comparison
 */
function normalize(str: string): string {
  return str
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

/**
 * Validate that a C file compiles without errors
 */
function validateCompilation(cFile: string): IValidationResult {
  try {
    execFileSync(
      "gcc",
      [
        "-fsyntax-only",
        "-std=c99",
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
      { encoding: "utf-8", timeout: 30000, stdio: "pipe" },
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
    execFileSync(
      "clang-tidy",
      [cFile, "--", "-std=c99", "-Wno-unused-variable"],
      { encoding: "utf-8", timeout: 30000, stdio: "pipe" },
    );
    return { valid: true };
  } catch (error: unknown) {
    const err = error as { stderr?: string; stdout?: string; message: string };
    const output = err.stderr || err.stdout || err.message;
    const issues = output
      .split("\n")
      .filter((line) => line.includes("warning:") || line.includes("error:"))
      .slice(0, 5)
      .join("\n");
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
 */
function validateMisra(cFile: string): IValidationResult {
  try {
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
 * Get a unique path for a test executable
 */
function getExecutablePath(cnxFile: string): string {
  const testName = basename(cnxFile, ".test.cnx");
  const uniqueId = randomBytes(4).toString("hex");
  return join(tmpdir(), `cnx-test-${testName}-${uniqueId}`);
}

/**
 * Check if generated C code requires ARM runtime
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
 * Compile and execute a C file
 */
function executeTest(
  cFile: string,
  expectedExitCode: number = 0,
): IValidationResult {
  const execPath = getExecutablePath(cFile);

  try {
    execFileSync(
      "gcc",
      [
        "-std=c99",
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

    try {
      execFileSync(execPath, [], {
        encoding: "utf-8",
        timeout: 5000,
        stdio: "pipe",
      });

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
 * Run a single test
 */
function runTest(cnxFile: string, updateMode: boolean): ITestResult {
  const source = readFileSync(cnxFile, "utf-8");
  const basePath = cnxFile.replace(/\.test\.cnx$/, "");
  const expectedCFile = basePath + ".expected.c";
  const expectedErrorFile = basePath + ".expected.error";

  const result = transpile(source);

  // Check if this is an error test
  if (existsSync(expectedErrorFile)) {
    const expectedErrors = readFileSync(expectedErrorFile, "utf-8").trim();

    if (result.success) {
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
      // Snapshot matches - run all validation steps

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

      // Execution test if marker present
      if (source.includes("/* test-execution */")) {
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
    if (source.includes("/* test-execution */")) {
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

  return {
    passed: false,
    message: "No expected file found. Run with --update to create snapshot.",
    noSnapshot: true,
  };
}

// Listen for messages from parent process via IPC
process.on("message", (message: TWorkerMessage) => {
  if (message.type === "init") {
    rootDir = message.rootDir;
    tools = message.tools;
    process.send!({ type: "ready" });
  } else if (message.type === "test") {
    const { cnxFile, updateMode } = message;
    try {
      const result = runTest(cnxFile, updateMode);
      process.send!({ type: "result", cnxFile, result });
    } catch (error: unknown) {
      const err = error as Error;
      process.send!({
        type: "result",
        cnxFile,
        result: {
          passed: false,
          message: `Worker error: ${err.message}`,
        },
      });
    }
  } else if (message.type === "exit") {
    process.exit(0);
  }
});

// Signal that the worker is loaded (but not yet initialized)
process.send!({ type: "loaded" });

export default runTest;
