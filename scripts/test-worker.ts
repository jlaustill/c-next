/**
 * Test Worker - Runs individual tests for parallel execution
 *
 * This worker receives test file paths via IPC and executes them,
 * returning results to the main process.
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import Pipeline from "../src/pipeline/Pipeline";
import IFileResult from "../src/pipeline/types/IFileResult";

// Import shared types
import ITools from "./types/ITools";
import ITestResult from "./types/ITestResult";

// Import shared test utilities
import TestUtils from "./test-utils";

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

// All validation functions imported from ./test-utils

/**
 * Run a single test
 */
async function runTest(
  cnxFile: string,
  updateMode: boolean,
): Promise<ITestResult> {
  const source = readFileSync(cnxFile, "utf-8");
  const basePath = cnxFile.replace(/\.test\.cnx$/, "");
  const expectedCFile = basePath + ".expected.c";
  const expectedErrorFile = basePath + ".expected.error";
  const headerFile = basePath + ".test.h";

  // Issue #230: If test has a corresponding .test.h file, enable self-include generation
  const hasHeaderFile = existsSync(headerFile);

  // Use Pipeline for transpilation with header parsing support
  // Issue #321: Use noCache: true to ensure tests always use fresh symbol collection
  // Caching can cause stale symbols when Pipeline code changes
  const pipeline = new Pipeline({
    inputs: [],
    includeDirs: [join(rootDir, "tests/include")],
    noCache: true,
  });

  const result: IFileResult = await pipeline.transpileSource(source, {
    workingDir: dirname(cnxFile),
    sourcePath: cnxFile,
    generateHeaders: hasHeaderFile, // Issue #230: Enable self-include for extern "C" tests
  });

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

    if (TestUtils.normalize(result.code) === TestUtils.normalize(expectedC)) {
      // Snapshot matches - run all validation steps

      if (tools.gcc) {
        const compileResult = TestUtils.validateCompilation(
          expectedCFile,
          tools,
          rootDir,
        );
        if (!compileResult.valid) {
          return {
            passed: false,
            message: "GCC compilation failed",
            actual: compileResult.message,
          };
        }
      }

      if (tools.cppcheck) {
        const cppcheckResult = TestUtils.validateCppcheck(expectedCFile);
        if (!cppcheckResult.valid) {
          return {
            passed: false,
            message: "Cppcheck failed",
            actual: cppcheckResult.message,
          };
        }
      }

      if (tools.clangTidy) {
        const clangTidyResult = TestUtils.validateClangTidy(expectedCFile);
        if (!clangTidyResult.valid) {
          return {
            passed: false,
            message: "Clang-tidy failed",
            actual: clangTidyResult.message,
          };
        }
      }

      if (tools.misra) {
        const misraResult = TestUtils.validateMisra(expectedCFile, rootDir);
        if (!misraResult.valid) {
          return {
            passed: false,
            message: "MISRA check failed",
            actual: misraResult.message,
          };
        }
      }

      // Flawfinder security analysis
      if (tools.flawfinder) {
        const flawfinderResult = TestUtils.validateFlawfinder(expectedCFile);
        if (!flawfinderResult.valid) {
          return {
            passed: false,
            message: "Flawfinder security check failed",
            actual: flawfinderResult.message,
          };
        }
      }

      // No-warnings check if marker present
      if (TestUtils.hasNoWarningsMarker(source)) {
        const noWarningsResult = TestUtils.validateNoWarnings(
          expectedCFile,
          rootDir,
        );
        if (!noWarningsResult.valid) {
          return {
            passed: false,
            message: "Warning check failed (test-no-warnings)",
            warningError: noWarningsResult.message,
          };
        }
      }

      // Execution test if marker present
      if (/^\s*\/\/\s*test-execution\s*$/m.test(source)) {
        if (TestUtils.requiresArmRuntime(result.code)) {
          return { passed: true, skippedExec: true };
        }

        const execResult = TestUtils.executeTest(expectedCFile, rootDir, 0);
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
      const tempCFile = expectedCFile.replace(".expected.c", ".tmp.c");
      writeFileSync(tempCFile, result.code);

      try {
        if (!TestUtils.requiresArmRuntime(result.code)) {
          const execResult = TestUtils.executeTest(tempCFile, rootDir, 0);
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
process.on("message", async (message: TWorkerMessage) => {
  if (message.type === "init") {
    rootDir = message.rootDir;
    tools = message.tools;
    process.send!({ type: "ready" });
  } else if (message.type === "test") {
    const { cnxFile, updateMode } = message;
    try {
      const result = await runTest(cnxFile, updateMode);
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
