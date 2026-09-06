#!/usr/bin/env tsx
/**
 * Issue #1322: recompute the line numbers in
 * `docs/architecture/output-throw-classification.md` from each row's anchor.
 *
 * This is a FIXER and is deliberately not in `scripts/gate.sh`. It writes; the
 * gate checks, re-deriving the answer from the source rather than trusting what
 * this produced. A tool that fixed and validated in one pass could only agree
 * with itself.
 *
 * `--dry-run` reports what would move and writes nothing.
 *
 * A refusal is not a failure of this tool -- it is the tool declining to guess.
 * Refusals exit non-zero so a scripted run cannot mistake "seven rows I could
 * not place" for success, and each names the row so it can be fixed by hand.
 */

import { readFileSync, writeFileSync } from "node:fs";

import chalk from "chalk";

import OutputThrowSources from "./diagnostics/OutputThrowSources";
import ThrowCitationRemap from "./diagnostics/ThrowCitationRemap";

function main(): void {
  const dryRun = process.argv.includes("--dry-run");
  const before = readFileSync(OutputThrowSources.docPath, "utf-8");
  const result = ThrowCitationRemap.remap(before, OutputThrowSources.read());

  for (const change of result.changes) {
    console.log(
      chalk.cyan(
        `  ${change.path}:${change.from} -> :${change.to}  (\`${change.anchor}\`)`,
      ),
    );
  }
  console.log(
    chalk.green(
      `${result.changes.length} row(s) remapped${dryRun ? " (dry run, nothing written)" : ""}.`,
    ),
  );

  if (!dryRun && result.markdown !== before) {
    writeFileSync(OutputThrowSources.docPath, result.markdown, "utf-8");
  }

  if (result.refusals.length > 0) {
    console.error(
      chalk.yellow(
        `\n${result.refusals.length} citation(s) could not be remapped and need a hand fix:\n` +
          result.refusals.map((refusal) => `  ${refusal}`).join("\n"),
      ),
    );
    process.exit(1);
  }
}

main();
