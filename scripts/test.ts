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
 *   npm test -- --transpile-only          # Transpile + snapshot comparison only (no compile/execute)
 *   npm test -- tests/enum                # Run specific directory
 *   npm test -- tests/enum/my.test.cnx    # Run single test file
 */

import { existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, fork, ChildProcess } from "node:child_process";
import { availableParallelism } from "node:os";
import ITools from "./types/ITools";
import ITestOptions from "./types/ITestOptions";
import ITestResult from "./types/ITestResult";
import ITestTotals from "./types/ITestTotals";
import TExecSkipReason from "./types/TExecSkipReason";

// Import shared test utilities
import TestUtils from "./test-utils";
import TargetMatrix from "./TargetMatrix";
import type ITargetCell from "./types/ITargetCell";
import FixtureScheduler from "./utils/FixtureScheduler";
import FileScanner from "./utils/FileScanner";
import TestOutcome from "./utils/TestOutcome";
import chalk from "chalk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

interface IWorkerResult {
  type: "result" | "ready" | "loaded";
  cnxFile?: string;
  result?: ITestResult;
}

// Use shared FileScanner.findTestFiles instead of local implementation

/**
 * Check if validation tools are available
 *
 * Static analysis tools (cppcheck, clang-tidy, MISRA, flawfinder) run as a
 * separate batch step via `npm run validate:c` / scripts/batch-validate.ts.
 */
function checkValidationTools(): ITools {
  const tools: ITools = {
    gcc: false,
  };

  try {
    execFileSync("gcc", ["--version"], { encoding: "utf-8", stdio: "pipe" });
    tools.gcc = true;
  } catch {
    // gcc not available
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
  options: ITestOptions = {},
): Promise<ITestResult> {
  return TestUtils.runTest(cnxFile, updateMode, tools, rootDir, options);
}

/**
 * Get mode indicator string for display
 */
function getModeIndicator(result: ITestResult): string {
  const modes: string[] = [];
  if (result.cResult && !result.cSkipped) modes.push("C");
  // "CPP" rather than "C++": joined with "+" the label reads "[C+C++]",
  // where the separator and the language name run together.
  if (result.cppResult && !result.cppSkipped) modes.push("CPP");
  // Only show indicator if running both modes
  if (modes.length === 2) {
    // Show parity status if both modes executed
    if (result.parityChecked && result.parityPassed) {
      return chalk.green(` [${modes.join("+")} PARITY]`);
    }
    return chalk.dim(` [${modes.join("+")}]`);
  }
  return "";
}

/**
 * Render why execution was skipped, or nothing when it was not.
 *
 * Issue #1397: this used to be a fixed `(exec skipped: ARM)` on any skip, while
 * two of the three skips are transpile-only -- so the stated cause was wrong in
 * the common case. An unrecorded reason prints bare rather than borrowing one.
 */
function execSkipNote(reason: TExecSkipReason | null): string {
  if (reason === null) {
    return "";
  }
  const details: Record<TExecSkipReason, string> = {
    target: ": not the host",
    xfail: ": host cell is an expected failure",
    "transpile-only": ": transpile-only",
    unspecified: "",
  };
  const label = "exec skipped";
  const detail = details[reason];
  return ` ${chalk.dim(`(${label}${detail})`)}`;
}

/**
 * #1668 box 15: which targets ran the fixture and how -- executed on the
 * host, compiled for the others, and each expected failure or target nothing
 * could compile for, by name.
 */
function targetsNote(cells: readonly ITargetCell[] | undefined): string {
  if (cells === undefined || cells.length === 0) {
    return "";
  }
  const named = (outcome: ITargetCell["outcome"]): string[] => [
    ...new Set(
      cells
        .filter((cell) => cell.outcome === outcome)
        .map((cell) => cell.target),
    ),
  ];
  const executed = named("executed");
  const groups: Array<[string, string[]]> = [
    ["executed", executed],
    [
      "compiled",
      named("compiled").filter((target) => !executed.includes(target)),
    ],
    ["xfail", named("xfail")],
  ];
  const parts = groups
    .filter((group) => group[1].length > 0)
    .map((group) => `${group[0]}: ${group[1].join(", ")}`);
  return parts.length === 0 ? "" : ` ${chalk.dim(`(${parts.join("; ")})`)}`;
}

/**
 * #1668 box 15: every target cell the run produced, by target and outcome,
 * and how many fixtures ran for one target alone rather than the matrix.
 */
const targetTotals = new Map<string, Map<string, number>>();
let pinnedFixtures = 0;

function recordTargets(result: ITestResult): void {
  const cells = result.cells ?? [];
  if (cells.length === 0) {
    return;
  }
  for (const cell of cells) {
    const outcomes = targetTotals.get(cell.target) ?? new Map<string, number>();
    outcomes.set(cell.outcome, (outcomes.get(cell.outcome) ?? 0) + 1);
    targetTotals.set(cell.target, outcomes);
  }
  const matrix = TargetMatrix.CROSS.every((target) =>
    cells.some((cell) => cell.target === target),
  );
  if (!matrix) {
    pinnedFixtures += 1;
  }
}

/** The per-target totals, in quiet mode too (#1668's addendum, A6.5) */
function printTargetTotals(): void {
  if (targetTotals.size === 0) {
    return;
  }
  const targets = [...targetTotals.entries()].map(
    ([target, outcomes]) =>
      `${target} ${[...outcomes.entries()].map(([outcome, count]) => `${count} ${outcome}`).join(", ")}`,
  );
  console.log(
    `${chalk.cyan("Target cells:")} ${targets.join("; ")}; ${pinnedFixtures} fixtures pinned to one target`,
  );
}

/**
 * Print a test result
 */
function printResult(
  relativePath: string,
  result: ITestResult,
  quietMode: boolean,
): void {
  const modeIndicator = getModeIndicator(result);
  const outcome = TestOutcome.classify(result);

  if (outcome.kind === "updated") {
    if (!quietMode) {
      console.log(`${chalk.yellow("UPDATED")} ${relativePath}${modeIndicator}`);
    }
    return;
  }

  if (outcome.kind === "passed") {
    if (!quietMode) {
      console.log(
        `${chalk.green("PASS")}    ${relativePath}${modeIndicator}${execSkipNote(outcome.execSkip)}${targetsNote(result.cells)}`,
      );
    }
    return;
  }

  // An `if`-chain falls through, so a kind added to TTestOutcome would be
  // silently rendered as a failure here. This makes that a compile error the
  // moment `scripts/` enters `tsconfig` (#1489), and a loud one before then.
  if (outcome.kind !== "failed") {
    const unhandled: never = outcome;
    throw new Error(`unhandled test outcome: ${JSON.stringify(unhandled)}`);
  }

  console.log(
    `${chalk.red("FAIL")}    ${relativePath}${modeIndicator}${targetsNote(result.cells)}`,
  );

  // Issue #1397: a missing snapshot fails the build, so it prints as a failure
  // rather than as SKIP. There is nothing to diff against, so the line carries
  // the command that creates the snapshot instead of the generated output.
  if (outcome.missingSnapshot) {
    console.log(
      `        ${chalk.dim(`no snapshot - run: npm test -- ${relativePath} --update`)}`,
    );
    return;
  }

  console.log(`        ${chalk.dim(result.message ?? "")}`);
  // #1668 box 15: every other target cell that failed, so one run shows the
  // whole matrix rather than the first failing cell
  for (const cell of result.cells ?? []) {
    if (cell.outcome === "failed" && cell.detail !== result.message) {
      const firstLine = (cell.detail ?? "").split("\n")[0];
      console.log(
        `        ${chalk.dim(`${cell.target} ${cell.mode}: ${firstLine}`)}`,
      );
    }
  }
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
  // Show parity mismatch details (Issue #922)
  if (result.parityError) {
    console.log(
      `        ${chalk.red("Parity mismatch - C and C++ outputs differ:")}`,
    );
    for (const line of result.parityError.split("\n").slice(0, 10)) {
      console.log(`          ${chalk.dim(line)}`);
    }
  }
}

/**
 * Get counter updates based on test result.
 *
 * Issue #1397: this reads the SAME outcome `printResult` renders, rather than
 * re-deriving one from `passed`/`noSnapshot`. `noSnapshot` counts a subset of
 * `failed`, so the totals partition the fixtures instead of holding one twice.
 */
function getCounterUpdates(result: ITestResult): ITestTotals {
  const updates: ITestTotals = {
    passed: 0,
    failed: 0,
    updated: 0,
    noSnapshot: 0,
  };

  const outcome = TestOutcome.classify(result);

  if (outcome.kind === "updated") {
    updates.updated++;
    updates.passed++;
    return updates;
  }

  if (outcome.kind === "passed") {
    updates.passed++;
    return updates;
  }

  // Same exhaustiveness guard as printResult: without it a new kind would be
  // counted as a failure here and rendered as one there -- each place
  // defaulting on its own, which is what TTestOutcome exists to prevent.
  if (outcome.kind !== "failed") {
    const unhandled: never = outcome;
    throw new Error(`unhandled test outcome: ${JSON.stringify(unhandled)}`);
  }

  updates.failed++;
  if (outcome.missingSnapshot) {
    updates.noSnapshot++;
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
  options: ITestOptions = {},
): Promise<ITestTotals> {
  return new Promise((resolve) => {
    let passed = 0;
    let failed = 0;
    let updated = 0;
    let noSnapshot = 0;

    const activeWorkers = new Map<ChildProcess, string>();
    // Workers that have processed their `init` and answered `ready`. A forked
    // worker is in `workers` before it has been initialized, and #1488's
    // broadcast offers work to EVERY worker in that array -- so without this an
    // uninitialized worker takes a fixture and runs it with `tools` undefined.
    // What the reader then sees is `Worker error: Cannot read properties of
    // undefined (reading 'gcc')` reported as a FAILURE of whichever fixture it
    // happened to claim, on CI, intermittently, blaming code that is fine.
    const readyWorkers = new Set<ChildProcess>();
    let completedCount = 0;

    // Issue #1488: a fixture's run writes its dependencies' generated files in
    // place, so two fixtures sharing one write the same generated `.h` at once
    // and the snapshot comparison reads a file mid-rewrite -- the same commit
    // failing on CI and passing on re-run. A fixture's include closure acts as
    // a lock: it starts only when no in-flight fixture holds a file in it.
    // Fixtures that share nothing -- the overwhelming majority -- are
    // unconstrained and still run fully parallel.
    const scheduler = new FixtureScheduler(cnxFiles, (file) =>
      TestUtils.helperClosure(file),
    );
    const releaseHelpers = (cnxFile: string | undefined): void =>
      scheduler.release(cnxFile);

    // Results are stored and printed in order for consistent output
    const results = new Map<string, ITestResult>();

    // #1544: which fixture wrote each dependency's generated file, and what it
    // wrote. Accumulated across the whole run so the second writer of a shared
    // helper can be compared against the first.
    const dependencyWriters = new Map<
      string,
      { fixture: string; digest: string }
    >();
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
        recordTargets(result);

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
          worker.send({ type: "init", rootDir, tools, options });
        } else if (message.type === "ready") {
          // Worker is initialized, assign work
          readyWorkers.add(worker);
          assignWork(worker);
        } else if (
          message.type === "result" &&
          message.cnxFile &&
          message.result
        ) {
          // #1544: a dependency's generated files belong to the program that
          // included them, so two fixtures sharing a helper must agree on its
          // bytes -- only one file survives on disk. Checked here because the
          // parent is the only participant that sees more than one fixture;
          // the worker cannot know it is the second writer. Folded into the
          // fixture's own result so it prints and counts like any failure.
          const disagreement = TestUtils.findDependencyDisagreement(
            message.cnxFile,
            message.result.dependencyDigests ?? {},
            dependencyWriters,
          );
          if (disagreement && message.result.passed) {
            message.result.passed = false;
            message.result.message = disagreement;
          }

          // Store result
          results.set(message.cnxFile, message.result);
          releaseHelpers(activeWorkers.get(worker));
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
            // Assign more work. Every idle worker is offered, not just this
            // one: a helper just released may be what another worker was
            // waiting on, and nothing else would wake it (#1488).
            assignWorkToIdleWorkers();
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
        releaseHelpers(activeWorkers.get(worker));
        activeWorkers.delete(worker);
        removeWorker(worker);

        // Replace crashed worker if there's more work
        if (scheduler.pendingCount > 0) {
          const newWorker = createWorker();
          workers.push(newWorker);
        }

        // The helpers this worker held are free now, and a live worker may have
        // been idling on exactly them. Nothing else would wake it: work is
        // re-offered on a `result` message, and a dead worker sends none.
        assignWorkToIdleWorkers();

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
        releaseHelpers(activeWorkers.get(worker));
        activeWorkers.delete(worker);
        removeWorker(worker);

        if (completedCount === cnxFiles.length) {
          resolve({ passed, failed, updated, noSnapshot });
          return;
        }

        // Same reason as the error path: without this, a worker dying while
        // every remaining fixture is blocked on the helpers it held leaves all
        // workers idle, work still pending, and no message left to arrive.
        assignWorkToIdleWorkers();
      });

      return worker;
    }

    // A crashed worker must leave the pool. `assignWork` used to be called only
    // on a worker that had just proved it was alive -- its own `ready` or its own
    // `result` -- so a dead entry lingering in `workers` was harmless. Offering
    // work to every idle worker removed that guarantee: a dead entry would take
    // a fixture, lock its helpers, and `send()` into a closed channel, turning
    // one crash into a spurious failure per remaining fixture.
    function removeWorker(worker: ChildProcess): void {
      readyWorkers.delete(worker);
      const at = workers.indexOf(worker);
      if (at !== -1) {
        workers.splice(at, 1);
      }
    }

    function assignWork(worker: ChildProcess): void {
      // `readyWorkers` first: connected says the channel is open, which a worker
      // is from the moment it is forked -- long before it has been told which
      // tools exist. Its own `ready` is the only proof it can run a fixture.
      if (
        !readyWorkers.has(worker) ||
        activeWorkers.has(worker) ||
        !worker.connected
      ) {
        return;
      }
      // Take the first pending fixture none of whose helpers another worker
      // holds. When everything left is blocked the worker simply idles; the
      // completion that frees a helper re-offers work to every idle worker.
      const cnxFile = scheduler.claim();
      if (cnxFile === null) {
        return;
      }
      activeWorkers.set(worker, cnxFile);
      worker.send({ type: "test", cnxFile, updateMode });
    }

    function assignWorkToIdleWorkers(): void {
      for (const idle of workers) {
        assignWork(idle);
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
  options: ITestOptions = {},
): Promise<ITestTotals> {
  let passed = 0;
  let failed = 0;
  let updated = 0;
  let noSnapshot = 0;

  for (const cnxFile of cnxFiles) {
    const relativePath = cnxFile.replace(rootDir + "/", "");
    const result = await runTest(cnxFile, updateMode, tools, options);

    printResult(relativePath, result, quietMode);
    recordTargets(result);

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
  const transpileOnly = args.includes("--transpile-only");

  // Build test options
  const testOptions: ITestOptions = {
    transpileOnly,
  };

  // Parse --jobs argument
  // availableParallelism, not cpus().length: a runner pinned to some cores
  // sees only those, so it does not start a worker per core of the machine.
  let numJobs = availableParallelism();
  const jobsIndex = args.findIndex((arg) => arg === "--jobs" || arg === "-j");
  if (jobsIndex !== -1 && args[jobsIndex + 1]) {
    const parsed = Number.parseInt(args[jobsIndex + 1], 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      numJobs = parsed;
    }
  }

  // #1508 follow-up: every path argument, not just the first.
  //
  // This was `args.find(...)`, which took the first and dropped the rest in
  // silence: `npm test -- dirA dirB` ran ONLY dirA and reported its result as
  // the whole answer. Green then meant "the first path passed", which is
  // indistinguishable from "both passed" and is the more reassuring reading.
  //
  // Refused rather than supported. Running several paths is a new capability
  // with its own surface; refusing an ambiguous invocation is the removal of a
  // wrong answer, and no caller in the repo passes more than one path.
  const pathArgs = args.filter(
    (arg) =>
      !arg.startsWith("-") && (jobsIndex === -1 || arg !== args[jobsIndex + 1]), // Exclude the number after --jobs
  );

  if (pathArgs.length > 1) {
    console.error(
      chalk.red(
        `Error: expected at most one test path, got ${pathArgs.length}: ${pathArgs.join(", ")}`,
      ),
    );
    console.error(
      chalk.red(
        "Only the first would have run, and its result would have been reported as the whole suite's.",
      ),
    );
    process.exit(1);
  }

  const filterPath = pathArgs[0];

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

  // Require at least GCC for compilation check (unless transpile-only mode)
  if (!tools.gcc && !transpileOnly) {
    console.error(
      chalk.red("Error: gcc is required for C compilation validation"),
    );
    process.exit(1);
  }

  // #1668 box 13: every cross target's compiler and real library, checked
  // once before any fixture runs. A missing one fails here, loudly.
  if (!transpileOnly) {
    const problems = TargetMatrix.preflight((unit, mode, toolchain) =>
      TestUtils.compileTranslationUnit(
        unit,
        dirname(unit),
        rootDir,
        mode,
        toolchain,
        false,
      ),
    );
    if (problems.length > 0) {
      console.error(
        chalk.red("Error: the target matrix cannot compile for every target:"),
      );
      for (const problem of problems) {
        console.error(chalk.red(`  ${problem}`));
      }
      console.error(
        `Install the cross toolchains: ${TargetMatrix.installCommand(rootDir)}`,
      );
      process.exit(1);
    }
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

    // Show test mode
    if (transpileOnly) {
      console.log(chalk.cyan("Mode: transpile-only (skip compile/execute)"));
    } else {
      // Show available validation tools
      console.log(chalk.cyan(`Validation: ${tools.gcc ? "gcc" : "(no gcc)"}`));
    }

    // Show parallelism info
    if (numJobs > 1) {
      console.log(chalk.cyan(`Workers: ${numJobs} parallel`));
    } else {
      console.log(chalk.dim("Mode: sequential"));
    }
    console.log();
  }

  // Discover test files: single file or recursive directory scan
  const cnxFiles = isSingleFile
    ? [testPath]
    : FileScanner.findTestFiles(testPath);

  if (cnxFiles.length === 0) {
    console.log(chalk.yellow("No .test.cnx test files found"));
    process.exit(0);
  }

  // Run tests (parallel or sequential)
  let results: ITestTotals;

  // #1668 box 15: each cross target transpiles into its own copy of tests/
  if (!transpileOnly) {
    testOptions.targetMirrors = TargetMatrix.createMirrors(rootDir);
  }
  try {
    if (numJobs > 1 && cnxFiles.length > 1) {
      results = await runTestsParallel(
        cnxFiles,
        updateMode,
        quietMode,
        tools,
        numJobs,
        testOptions,
      );
    } else {
      results = await runTestsSequential(
        cnxFiles,
        updateMode,
        quietMode,
        tools,
        testOptions,
      );
    }
  } finally {
    if (testOptions.targetMirrors !== undefined) {
      TargetMatrix.removeMirrors(testOptions.targetMirrors);
    }
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
      // Issue #1397: missing snapshots are a subset of the failures, reported
      // as a clarifier rather than as a bucket beside them. Printed as
      // "Skipped" they read as benign while still failing the build, and the
      // same fixture was counted in both lines.
      const noSnapshotNote =
        noSnapshot > 0 ? chalk.dim(` (${noSnapshot} with no snapshot)`) : "";
      console.log(`  ${chalk.red("Failed:")}  ${failed}${noSnapshotNote}`);
    }
    if (updated > 0) {
      console.log(`  ${chalk.yellow("Updated:")} ${updated}`);
    }
  }
  printTargetTotals();

  process.exit(failed > 0 ? 1 : 0);
}

main();

export default main;
