#!/usr/bin/env tsx
/**
 * Issue #1316: the committed manifest of fixtures that assert a diagnostic.
 *
 * A `.expected.error` is the only assertion that a diagnostic fires, and nothing
 * noticed one going away. Under `--update` the harness unlinked it and reported
 * the run green; by hand it is a deleted file, which reads as tidying. Either way
 * a lost diagnostic and an intentional fix were indistinguishable -- on the one
 * command a diagnostic migration runs repeatedly, across 287 fixtures.
 *
 * Modes are write / check, following `scripts/adr-matrix.ts`: `check`
 * regenerates in memory, diffs against what is committed, AND reports shrinkage.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import chalk from "chalk";
import prettier from "prettier";

import DiagnosticManifest from "./diagnostics/DiagnosticManifest";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(rootDir, "docs", "diagnostic-manifest.md");

/**
 * Format through Prettier before writing or comparing.
 *
 * The pre-commit hook formats staged markdown, so a generator emitting
 * unformatted output would produce a committed file that never matches what it
 * generates -- making the check fail permanently in CI.
 */
async function formatMarkdown(markdown: string): Promise<string> {
  const config = await prettier.resolveConfig(manifestPath);
  return prettier.format(markdown, {
    ...config,
    filepath: manifestPath,
    parser: "markdown",
  });
}

async function main(): Promise<void> {
  const mode = process.argv[2] ?? "check";
  if (mode !== "write" && mode !== "check") {
    console.error(chalk.red(`Unknown mode '${mode}'. Use write or check.`));
    process.exit(1);
  }

  const current = DiagnosticManifest.collect(rootDir);
  const document = await formatMarkdown(DiagnosticManifest.render(current));
  const committed = existsSync(manifestPath)
    ? readFileSync(manifestPath, "utf-8")
    : null;

  // Both modes decide in DiagnosticManifest and only print here, so the
  // ordering between "an assertion was lost" and "the file is stale" is
  // reachable from a test rather than buried in a CLI entry point.
  const outcome =
    mode === "write"
      ? DiagnosticManifest.writeOutcome(committed, current)
      : DiagnosticManifest.checkOutcome(committed, current, document);

  if (mode === "write") {
    writeFileSync(manifestPath, document);
    console.log(
      chalk.green(`Wrote ${manifestPath} (${current.length} fixture(s))`),
    );
  }

  for (const line of outcome.warnings) {
    console.warn(chalk.yellow(line));
  }
  for (const line of outcome.info) {
    console.log(chalk.green(line));
  }
  if (!outcome.ok) {
    console.error(chalk.red(outcome.errors.join("\n")));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
