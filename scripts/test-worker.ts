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
        const expectedHFile = join(
          dirname(helperCnx),
          `${helperBaseName}.expected.h`,
        );

        writeFileSync(tempHFile, helperResult.headerCode);
        tempHelperFiles.push(tempHFile);

        // Validate against expected header if it exists
        if (existsSync(expectedHFile)) {
          const expectedH = readFileSync(expectedHFile, "utf-8");
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

      // Issue #455: Write header file to disk if generated AND expected.h exists
      // Only write headers for tests that expect header validation
      if (result.headerCode && hasExpectedHFile) {
        writeFileSync(headerFile, result.headerCode);
      }

      // Helper to cleanup temp files (header files are preserved for success tests)
      const cleanupAllFiles = (): void => {
        cleanupHelperFiles();
      };

      // Issue #461: Skip GCC validation for transpile-only tests (e.g., C++ interop)
      const isTranspileOnly = TestUtils.hasTranspileOnlyMarker(source);

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

      // Flawfinder security analysis
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

      // Issue #455: Header validation (if .expected.h file exists AND headers were generated)
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
