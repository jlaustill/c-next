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
import prettier from "prettier";

import ScopeJoinSites from "./scope-joins/ScopeJoinSites";
import FileScanner from "./utils/FileScanner";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const docPath = join(rootDir, "docs", "architecture", "scope-join-sites.md");
const srcDir = join(rootDir, "src");

/**
 * Format through Prettier before writing or comparing.
 *
 * The pre-commit hook formats staged markdown, so a generator emitting
 * unformatted output would produce a committed file that never matches what it
 * generates -- making the check fail permanently in CI.
 */
async function formatMarkdown(markdown: string): Promise<string> {
  const config = await prettier.resolveConfig(docPath);
  return prettier.format(markdown, {
    ...config,
    filepath: docPath,
    parser: "markdown",
  });
}

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
  const mode = process.argv[2] ?? "check";
  if (mode !== "write" && mode !== "check") {
    console.error(chalk.red(`Unknown mode '${mode}'. Use write or check.`));
    process.exit(1);
  }

  const counts = ScopeJoinSites.count(collectSources());
  const document = await formatMarkdown(ScopeJoinSites.render(counts));

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
