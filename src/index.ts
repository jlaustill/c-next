#!/usr/bin/env node
/**
 * C-Next Transpiler CLI
 * A safer C for embedded systems development
 */

import Cli from "./cli/Cli";
import Runner from "./cli/Runner";

async function main(): Promise<void> {
  const result = Cli.run();

  if (result.shouldRun && result.config) {
    await Runner.execute(result.config);
  }

  process.exit(result.exitCode);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
