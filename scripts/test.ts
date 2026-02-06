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

import { existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, fork, ChildProcess } from "node:child_process";
import { cpus } from "node:os";
import ITools from "./types/ITools";
import ITestResult from "./types/ITestResult";

// Import shared test utilities
import TestUtils from "./test-utils";
import chalk from "chalk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

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
 * Delegates to shared TestUtils.runTest() to eliminate duplication with test-worker.ts
 */
async function runTest(
  cnxFile: string,
  updateMode: boolean,
  tools: ITools,
): Promise<ITestResult> {
  return TestUtils.runTest(cnxFile, updateMode, tools, rootDir);
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
        console.log(`${chalk.yellow("UPDATED")} ${relativePath}`);
      }
    } else if (result.skippedExec) {
      if (!quietMode) {
        console.log(
          `${chalk.green("PASS")}    ${relativePath} ${chalk.dim("(exec skipped: ARM)")}`,
        );
      }
    } else if (!quietMode) {
      console.log(`${chalk.green("PASS")}    ${relativePath}`);
    }
  } else if (result.noSnapshot) {
    console.log(`${chalk.yellow("SKIP")}    ${relativePath} (no snapshot)`);
  } else {
    console.log(`${chalk.red("FAIL")}    ${relativePath}`);
    console.log(`        ${chalk.dim(result.message ?? "")}`);
    if (result.expected && result.actual) {
      console.log(`        ${chalk.dim("Expected:")}`);
      console.log(
        `        ${result.expected.split("\n").slice(0, 5).join("\n        ")}`,
      );
      console.log(`        ${chalk.dim("Actual:")}`);
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
      console.log(`        ${chalk.red("Exec error:")} ${result.execError}`);
    }
    // Show warning error if present (test-no-warnings failure)
    if (result.warningError) {
      console.log(`        ${chalk.red("Warning:")} ${result.warningError}`);
    }
  }
}

interface ICounterUpdates {
  passed: number;
  failed: number;
  updated: number;
  noSnapshot: number;
}

/**
 * Get counter updates based on test result
 */
function getCounterUpdates(result: ITestResult): ICounterUpdates {
  const updates: ICounterUpdates = {
    passed: 0,
    failed: 0,
    updated: 0,
    noSnapshot: 0,
  };

  if (result.passed) {
    if (result.updated) {
      updates.updated++;
    }
    updates.passed++;
  } else {
    if (result.noSnapshot) {
      updates.noSnapshot++;
    }
    updates.failed++;
  }

  return updates;
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

        const updates = getCounterUpdates(result);
        passed += updates.passed;
        failed += updates.failed;
        updated += updates.updated;
        noSnapshot += updates.noSnapshot;

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

    const updates = getCounterUpdates(result);
    passed += updates.passed;
    failed += updates.failed;
    updated += updates.updated;
    noSnapshot += updates.noSnapshot;
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
    console.error(chalk.red(`Error: Test path not found: ${testPath}`));
    process.exit(1);
  }

  const pathStat = statSync(testPath);
  const isSingleFile = pathStat.isFile();

  // Validate single file has correct extension
  if (isSingleFile && !testPath.endsWith(".test.cnx")) {
    console.error(
      chalk.red(`Error: Test file must end with .test.cnx: ${testPath}`),
    );
    process.exit(1);
  }

  // Always check for validation tools (validation is mandatory)
  const tools = checkValidationTools();

  // Require at least GCC for compilation check
  if (!tools.gcc) {
    console.error(
      chalk.red("Error: gcc is required for C compilation validation"),
    );
    process.exit(1);
  }

  if (!quietMode) {
    console.log(chalk.cyan("C-Next Integration Tests"));
    console.log(
      chalk.dim(`Test ${isSingleFile ? "file" : "directory"}: ${testPath}`),
    );
    if (updateMode) {
      console.log(
        chalk.yellow("Update mode: snapshots will be created/updated"),
      );
    }

    // Show available validation tools
    const toolList: string[] = [];
    if (tools.gcc) toolList.push("gcc");
    if (tools.cppcheck) toolList.push("cppcheck");
    if (tools.clangTidy) toolList.push("clang-tidy");
    if (tools.misra) toolList.push("MISRA");
    if (tools.flawfinder) toolList.push("flawfinder");
    console.log(chalk.cyan(`Validation: ${toolList.join(" → ")}`));

    // Show parallelism info
    if (numJobs > 1) {
      console.log(chalk.cyan(`Workers: ${numJobs} parallel`));
    } else {
      console.log(chalk.dim("Mode: sequential"));
    }
    console.log();
  }

  // Discover test files: single file or recursive directory scan
  const cnxFiles = isSingleFile ? [testPath] : findCnxFiles(testPath);

  if (cnxFiles.length === 0) {
    console.log(chalk.yellow("No .test.cnx test files found"));
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
      const failedMsg = chalk.red(failed + " failed");
      console.log(`${passed}/${cnxFiles.length} tests passed, ${failedMsg}`);
    } else {
      console.log(
        chalk.green(`${cnxFiles.length}/${cnxFiles.length} tests passed`),
      );
    }
  } else {
    console.log();
    console.log(chalk.cyan("Results:"));
    console.log(`  ${chalk.green("Passed:")}  ${passed}`);
    if (failed > 0) {
      console.log(`  ${chalk.red("Failed:")}  ${failed}`);
    }
    if (updated > 0) {
      console.log(`  ${chalk.yellow("Updated:")} ${updated}`);
    }
    if (noSnapshot > 0) {
      console.log(`  ${chalk.yellow("Skipped:")} ${noSnapshot} (no snapshot)`);
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();

export default main;
