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
  const current = DiagnosticManifest.collect(rootDir);
  const document = await formatMarkdown(DiagnosticManifest.render(current));

  if (mode === "write") {
    writeFileSync(manifestPath, document);
    console.log(
      chalk.green(`Wrote ${manifestPath} (${current.length} fixture(s))`),
    );
    return;
  }

  if (mode !== "check") {
    console.error(chalk.red(`Unknown mode '${mode}'. Use write or check.`));
    process.exit(1);
  }

  if (!existsSync(manifestPath)) {
    console.error(
      chalk.red(
        `docs/diagnostic-manifest.md is missing. Run: npm run diagnostics:manifest`,
      ),
    );
    process.exit(1);
  }

  const committedDocument = readFileSync(manifestPath, "utf-8");
  const failures = DiagnosticManifest.diff(
    DiagnosticManifest.parse(committedDocument),
    current,
  );

  if (failures.length > 0) {
    console.error(
      chalk.red(
        `${failures.length} fixture(s) no longer assert what the manifest records:`,
      ),
    );
    for (const failure of failures) {
      console.error(
        chalk.red(
          `  ${failure.fixture}: ${failure.detail} [${failure.reason}]`,
        ),
      );
    }
    console.error(
      chalk.red(
        "\nIf a diagnostic was removed on purpose, delete its row from\n" +
          "docs/diagnostic-manifest.md in the same commit so the loss is reviewed.",
      ),
    );
    process.exit(1);
  }

  if (committedDocument !== document) {
    // Growth alone reaches here: a new fixture or a promoted code. It is not a
    // failure of the guard, but the committed file must still track it, or the
    // next real shrinkage diffs against a stale baseline.
    console.error(
      chalk.red(
        "docs/diagnostic-manifest.md is stale. Run: npm run diagnostics:manifest",
      ),
    );
    process.exit(1);
  }

  // Say what was enforced, not just that nothing failed. An identical line for
  // 287 fixtures and for zero is what would let a silently-emptied manifest pass
  // unremarked in a CI log.
  const coded = current.filter((entry) => entry.codes.length > 0).length;
  console.log(
    chalk.green(
      `Diagnostic manifest is satisfied ` +
        `(${current.length} fixture(s) asserting a diagnostic, ${coded} coded)`,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
