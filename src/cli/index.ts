#!/usr/bin/env node
/**
 * C-Next Transpiler CLI
 * A safer C for embedded systems development
 */

import Cli from "./Cli";
import Runner from "./Runner";
import ServeCommand from "./serve/ServeCommand";

/**
 * Main entry point for the CLI
 * Exported for testability
 */
async function main(): Promise<void> {
  const result = Cli.run();

  // Handle serve mode (JSON-RPC server)
  if (result.serveMode) {
    await ServeCommand.run({ debug: result.serveDebug });
    process.exit(0);
  }

  if (result.shouldRun && result.config) {
    await Runner.execute(result.config);
  }

  process.exit(result.exitCode);
}

// Only auto-execute when run directly (not when imported for testing)
// Check for vitest environment variable set by the test runner
if (!process.env.VITEST) {
  try {
    await main();
  } catch (err: unknown) {
    console.error("Unexpected error:", err);
    process.exit(1);
  }
}

export default main;
