/**
 * Test Worker - Runs individual tests for parallel execution
 *
 * This worker receives test file paths via IPC and executes them,
 * returning results to the main process.
 */

// Import shared types
import ITools from "./types/ITools";
import ITestOptions from "./types/ITestOptions";
import ITestResult from "./types/ITestResult";

// Import shared test utilities
import TestUtils from "./test-utils";

interface IInitMessage {
  type: "init";
  rootDir: string;
  tools: ITools;
  options?: ITestOptions;
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
let tools: ITools | undefined;
let testOptions: ITestOptions = {};

/**
 * Run a single test
 * Delegates to shared TestUtils.runTest() to eliminate duplication with test.ts
 */
async function runTest(
  cnxFile: string,
  updateMode: boolean,
): Promise<ITestResult> {
  // Belt to the parent's braces. If a `test` ever arrives before `init` again,
  // the first thing to dereference `tools` was `TestUtils.runTest` reading
  // `tools.gcc`, and the catch below reported that as a failure OF THE FIXTURE
  // -- an infrastructure crash wearing a test result's clothes. Saying so here
  // costs one branch and keeps the next occurrence self-describing.
  if (tools === undefined) {
    throw new Error(
      "worker received a test before its init message; " +
        "this is a harness scheduling fault, not a fixture failure",
    );
  }
  return TestUtils.runTest(cnxFile, updateMode, tools, rootDir, testOptions);
}

// Listen for messages from parent process via IPC
process.on("message", async (message: TWorkerMessage) => {
  if (message.type === "init") {
    rootDir = message.rootDir;
    tools = message.tools;
    testOptions = message.options || {};
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
