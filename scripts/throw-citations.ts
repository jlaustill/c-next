#!/usr/bin/env tsx
/**
 * Issue #1365: verify `docs/architecture/output-throw-classification.md`.
 *
 * Check-only. There is no `write` mode here because a fixer that also validated
 * could only ever agree with itself -- the `/* test-no-warnings *\/` shape
 * (#1143). `npm run docs:throw-citations:remap` is that fixer, deliberately a
 * separate command outside `gate.sh`, so this re-derives its answer
 * independently afterwards. It refuses wherever an anchor does not identify
 * exactly one throw, which is the guess the original no-fixer note was
 * protecting against: nine sites share a message.
 */

import { readFileSync } from "node:fs";

import chalk from "chalk";

import OutputThrowSources from "./diagnostics/OutputThrowSources";
import ThrowCitations from "./diagnostics/ThrowCitations";

function main(): void {
  const outcome = ThrowCitations.check(
    readFileSync(OutputThrowSources.docPath, "utf-8"),
    OutputThrowSources.read(),
  );

  for (const line of outcome.info) {
    console.log(chalk.green(line));
  }
  if (!outcome.ok) {
    console.error(
      chalk.red(
        `docs/architecture/output-throw-classification.md is out of date:\n` +
          outcome.errors.map((error) => `  ${error}`).join("\n"),
      ),
    );
    process.exit(1);
  }
}

main();
