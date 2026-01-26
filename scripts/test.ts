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
} from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, fork, ChildProcess } from "node:child_process";
import { cpus } from "node:os";
import Pipeline from "../src/pipeline/Pipeline";
import IFileResult from "../src/pipeline/types/IFileResult";
import ITools from "./types/ITools";
import ITestResult from "./types/ITestResult";

// Import shared test utilities
import TestUtils from "./test-utils";

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

// normalize, hasNoWarningsMarker, requiresArmRuntime, requiresCpp14,
// validateCompilation, validateCppcheck, validateClangTidy, validateMisra,
// validateNoWarnings, executeTest, getExecutablePath imported from ./test-utils

/**
 * Check if validation tools are available
 */
function checkValidationTools(): ITools {
  const tools: ITools = {
    gcc: false,
    cppcheck: false,
    clangTidy: false,
    misra: false,
    flawfinder: false,
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

  try {
    execFileSync("flawfinder", ["--version"], {
      encoding: "utf-8",
      stdio: "pipe",
    });
    tools.flawfinder = true;
  } catch {
    // flawfinder not available
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
  // Issue #424: If test has a corresponding .expected.h file, enable header validation
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

  // Check if this is an error test (no validation needed for error tests)
  if (existsSync(expectedErrorFile)) {
    const expectedErrors = readFileSync(expectedErrorFile, "utf-8").trim();

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

      // Issue #455: Write header file to disk if generated (needed for GCC to find the include)
      let headerFileWritten = false;
      if (result.headerCode) {
        writeFileSync(headerFile, result.headerCode);
        headerFileWritten = true;
      }

      // Helper to cleanup header file along with other temp files
      const cleanupAllFiles = (): void => {
        cleanupHelperFiles();
        if (headerFileWritten) {
          try {
            unlinkSync(headerFile);
          } catch {
            // Ignore cleanup errors
          }
        }
      };

      // Step 1: GCC compilation
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

      // Step 2: Cppcheck static analysis
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

      // Step 3: Clang-tidy analysis
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

      // Step 4: MISRA compliance check
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

      // Step 5: Flawfinder security analysis
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

      // Step 6: No-warnings check (if /* test-no-warnings */ marker present)
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

      // Step 6.5: Header validation (if .expected.h file exists AND headers were generated) - Issue #424
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

  // No expected file and not in update mode
  cleanupHelperFiles();
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
    const parsed = Number.parseInt(args[jobsIndex + 1], 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
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
    if (tools.flawfinder) toolList.push("flawfinder");
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
