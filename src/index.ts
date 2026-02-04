#!/usr/bin/env node
/**
 * C-Next Transpiler CLI
 * A safer C for embedded systems development
 */

import Cli from "./cli/Cli";
import Runner from "./cli/Runner";

/**
 * Main entry point for the CLI
 * Exported for testability
 */
async function main(): Promise<void> {
  const result = Cli.run();

  if (result.shouldRun && result.config) {
    await Runner.execute(result.config);
  }

  process.exit(result.exitCode);
}

// Only auto-execute when run directly (not when imported for testing)
// Check for vitest environment variable set by the test runner
/* v8 ignore start - module-level error handler cannot be tested without complex integration testing */
if (!process.env.VITEST) {
  void main().catch((err: unknown) => {
    console.error("Unexpected error:", err);
    process.exit(1);
  });
}
/* v8 ignore stop */

export default main;
