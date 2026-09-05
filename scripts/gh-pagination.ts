#!/usr/bin/env tsx
/**
 * Issue #1416: a `gh` read that silently returns page one is indistinguishable
 * from one that returned everything.
 *
 * There is no exemption mechanism, for the reason `adr-independence.ts` gives:
 * a gate that can be opted out of eventually is.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import chalk from "chalk";

import GhPagination from "./gh-pagination/GhPagination";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

const outcome = GhPagination.run(rootDir);

for (const violation of outcome.failures) {
  console.log(
    `${chalk.red("error")}  ${violation.file}:${violation.line}  ${violation.kind}  ${violation.detail}`,
  );
}

console.log(
  `Scanned ${outcome.scanned} tracked file(s) for gh invocations. No exemption mechanism exists.`,
);

if (outcome.failures.length > 0) {
  console.log(
    chalk.red(`\nUnbounded gh reads: ${outcome.failures.length} violation(s).`),
  );
  console.log(
    "gh list commands default to 30 and REST collections page at 30; neither reports it.",
  );
  console.log(
    "Fix with --limit N (and assert the count stays below it), or --paginate driving $endCursor.",
  );
  process.exit(1);
}

console.log(chalk.green("Every gh read is bounded."));
