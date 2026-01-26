/**
 * Test Worker - Runs individual tests for parallel execution
 *
 * This worker receives test file paths via IPC and executes them,
 * returning results to the main process.
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { join, dirname, basename } from "node:path";
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
  const headerFileName = basename(headerFile);

  // Issue #230: If test has a corresponding .test.h file, enable self-include generation
  const hasHeaderFile = existsSync(headerFile);
  // Issue #455: Also enable header generation if .expected.h exists (for header validation tests)
  const hasExpectedHFile = existsSync(expectedHFile);
  // Issue #455: Check if expected.c file includes the header (indicates header generation was intended)
  let expectedCIncludesHeader = false;
  if (existsSync(expectedCFile)) {
    const expectedCContent = readFileSync(expectedCFile, "utf-8");
    expectedCIncludesHeader = expectedCContent.includes(
      `#include "${headerFileName}"`,
    );
  }

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
    generateHeaders: hasHeaderFile || expectedCIncludesHeader,
  });

  // Issue #322: Find and transpile helper .cnx files for cross-file execution tests
  // Use test file basename for unique temp file naming to avoid parallel test collisions
  const testBaseName = basename(cnxFile, ".test.cnx");
  const helperCnxFiles = TestUtils.findHelperCnxFiles(cnxFile, source);
  const helperCFiles: string[] = [];
  const tempHelperFiles: string[] = [];

  for (const helperCnx of helperCnxFiles) {
    const helperSource = readFileSync(helperCnx, "utf-8");
    const helperResult = await pipeline.transpileSource(helperSource, {
      workingDir: dirname(helperCnx),
      sourcePath: helperCnx,
      generateHeaders: false,
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
    }
  }

  // Cleanup helper function for temp files
  const cleanupHelperFiles = (): void => {
    for (const f of tempHelperFiles) {
      try {
        if (existsSync(f)) unlinkSync(f);
      } catch {
        // Ignore cleanup errors
      }
    }
  };

  // Check if this is an error test
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
      return { passed: true, message: "Updated error snapshot", updated: true };
    }

    if (
      TestUtils.normalize(actualErrors) === TestUtils.normalize(expectedErrors)
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
      // Issue #455: Also update header snapshot if header was generated
      if (result.headerCode) {
        writeFileSync(expectedHFile, result.headerCode);
      }
      cleanupHelperFiles();
      return { passed: true, message: "Updated C snapshot", updated: true };
    }

    if (TestUtils.normalize(result.code) === TestUtils.normalize(expectedC)) {
      // Snapshot matches - run all validation steps

      // Issue #455: Write header file to disk if generated (needed for GCC to find the include)
      if (result.headerCode) {
        writeFileSync(headerFile, result.headerCode);
      }

      // Helper to cleanup temp files (header files are preserved for success tests)
      const cleanupAllFiles = (): void => {
        cleanupHelperFiles();
      };

      if (tools.gcc) {
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

      if (tools.cppcheck) {
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

      if (tools.clangTidy) {
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

      if (tools.misra) {
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

      // Flawfinder security analysis
      if (tools.flawfinder) {
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

      // Issue #455: Header validation (if .expected.h file exists AND headers were generated)
      if (hasExpectedHFile && result.headerCode) {
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

      // No-warnings check if marker present
      if (TestUtils.hasNoWarningsMarker(source)) {
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

      // Execution test if marker present
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
      const tempCFile = expectedCFile.replace(".expected.c", ".tmp.c");
      writeFileSync(tempCFile, result.code);

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
      return { passed: true, message: "Created error snapshot", updated: true };
    }
  }

  cleanupHelperFiles();
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
