#!/usr/bin/env tsx
/**
 * Issue #1357: gate the population of scope-denoting `fromParts` sites.
 *
 * `write` regenerates `docs/architecture/scope-join-sites.md`; `check`
 * regenerates in memory and fails when a file gained sites, or when the
 * committed document is stale because sites were removed. Following
 * `scripts/diagnostic-manifest.ts` and `scripts/adr-matrix.ts`.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

import chalk from "chalk";

import ScopeJoinSites from "./scope-joins/ScopeJoinSites";
import FileScanner from "./utils/FileScanner";
import GeneratedMarkdown from "./utils/GeneratedMarkdown";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const docPath = join(rootDir, "docs", "architecture", "scope-join-sites.md");
const srcDir = join(rootDir, "src");

function collectSources(): Map<string, string> {
  const sources = new Map<string, string>();
  for (const full of FileScanner.findFiles(srcDir, ".ts")) {
    if (full.includes(`${sep}__tests__${sep}`) || full.endsWith(".test.ts")) {
      continue;
    }
    sources.set(
      full
        .slice(rootDir.length + 1)
        .split(sep)
        .join("/"),
      readFileSync(full, "utf-8"),
    );
  }
  return sources;
}

async function main(): Promise<void> {
  const mode = GeneratedMarkdown.requireMode(process.argv[2]);

  const counts = ScopeJoinSites.count(collectSources());
  const document = await GeneratedMarkdown.format(
    ScopeJoinSites.render(counts),
    docPath,
  );

  if (mode === "write") {
    writeFileSync(docPath, document);
    const total = counts.reduce((sum, row) => sum + row.count, 0);
    console.log(chalk.green(`Wrote ${docPath} (${total} site(s))`));
    return;
  }

  if (!existsSync(docPath)) {
    console.error(
      chalk.red(`${docPath} is missing. Run \`npm run scope-joins\`.`),
    );
    process.exit(1);
  }

  const outcome = ScopeJoinSites.check(readFileSync(docPath, "utf-8"), counts);
  for (const line of outcome.info) {
    console.log(chalk.green(line));
  }
  if (!outcome.ok) {
    console.error(
      chalk.red(
        "docs/architecture/scope-join-sites.md is out of date:\n" +
          outcome.errors.map((error) => `  ${error}`).join("\n"),
      ),
    );
    process.exit(1);
  }
}

void main();
