/**
 * Test Worker - Runs individual tests for parallel execution
 *
 * This worker receives test file paths via IPC and executes them,
 * returning results to the main process.
 */

// Import shared types
import ITools from "./types/ITools";
import ITestResult from "./types/ITestResult";
import type { TTestMode } from "./types/ITestMode";

// Import shared test utilities
import TestUtils from "./test-utils";

interface IInitMessage {
  type: "init";
  rootDir: string;
  tools: ITools;
  modeFilter?: TTestMode;
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
let modeFilter: TTestMode | undefined;

/**
 * Run a single test
 * Delegates to shared TestUtils.runTest() to eliminate duplication with test.ts
 */
async function runTest(
  cnxFile: string,
  updateMode: boolean,
): Promise<ITestResult> {
  return TestUtils.runTest(cnxFile, updateMode, tools, rootDir, modeFilter);
}

// Listen for messages from parent process via IPC
process.on("message", async (message: TWorkerMessage) => {
  if (message.type === "init") {
    rootDir = message.rootDir;
    tools = message.tools;
    modeFilter = message.modeFilter;
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
