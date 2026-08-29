#!/usr/bin/env tsx
/**
 * Issue #1365: verify `docs/architecture/output-throw-classification.md`.
 *
 * Check-only. There is no `write` mode because the document is authored, not
 * generated -- a fixer would have to guess which throw a stale citation meant,
 * and nine sites share a message, so the guess is not safe. The failure lists
 * the nearest `throw new` instead, which is enough to correct a row by hand.
 */

import { readFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

import chalk from "chalk";

import ThrowCitations from "./diagnostics/ThrowCitations";
import FileScanner from "./utils/FileScanner";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const docPath = join(
  rootDir,
  "docs",
  "architecture",
  "output-throw-classification.md",
);
const outputDir = join(rootDir, "src", "transpiler", "output");

function main(): void {
  // FileScanner is the shared recursive walk this repo standardized on; two
  // other scripts carry a comment recording that a local copy was removed in
  // favour of it. The `__tests__` skip composes on top, and is what the
  // document's own command spells as `| grep -v __tests__`.
  const sources = new Map<string, string>();
  for (const full of FileScanner.findFiles(outputDir, ".ts")) {
    if (full.includes(`${sep}__tests__${sep}`)) {
      continue;
    }
    sources.set(full.slice(rootDir.length + 1), readFileSync(full, "utf-8"));
  }

  const outcome = ThrowCitations.check(readFileSync(docPath, "utf-8"), sources);

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
