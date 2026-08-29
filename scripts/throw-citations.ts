#!/usr/bin/env tsx
/**
 * Issue #1365: verify `docs/architecture/output-throw-classification.md`.
 *
 * Check-only. There is no `write` mode because the document is authored, not
 * generated -- a fixer would have to guess which throw a stale citation meant,
 * and nine sites share a message, so the guess is not safe. The failure lists
 * the nearest `throw new` instead, which is enough to correct a row by hand.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import chalk from "chalk";

import ThrowCitations from "./diagnostics/ThrowCitations";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const docPath = join(
  rootDir,
  "docs",
  "architecture",
  "output-throw-classification.md",
);
const outputDir = join(rootDir, "src", "transpiler", "output");

/** Every non-test `.ts` under `output/`, relative to the repo root. */
function collectSources(dir: string, into: Map<string, string>): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== "__tests__") {
        collectSources(full, into);
      }
    } else if (entry.endsWith(".ts")) {
      into.set(full.slice(rootDir.length + 1), readFileSync(full, "utf-8"));
    }
  }
}

function main(): void {
  const sources = new Map<string, string>();
  collectSources(outputDir, sources);

  const outcome = ThrowCitations.check(
    ThrowCitations.parse(readFileSync(docPath, "utf-8")),
    sources,
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
