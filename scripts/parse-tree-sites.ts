#!/usr/bin/env tsx
/**
 * Issue #1317: gate the population of modules holding an ANTLR parse tree.
 *
 * `write` regenerates `docs/architecture/parse-tree-sites.md`; `check`
 * regenerates in memory and fails when a module joined the population, or when
 * the committed document is stale because one left. Following
 * `scripts/scope-join-sites.ts` and `scripts/diagnostic-manifest.ts`.
 *
 * The population comes from dependency-cruiser, invoked through the SAME binary
 * and config `npm run depcruise` uses, so this check and the architecture rule
 * cannot drift apart -- there is one definition of "holds a parse tree" and it
 * lives in `.dependency-cruiser.cjs`.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import chalk from "chalk";

import ParseTreeSites from "./parse-tree/ParseTreeSites";
import type IDepcruiseViolation from "./types/IDepcruiseViolation";
import GeneratedMarkdown from "./utils/GeneratedMarkdown";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const docPath = join(rootDir, "docs", "architecture", "parse-tree-sites.md");

/**
 * Every violation dependency-cruiser reports for the whole config.
 *
 * `depcruise` exits non-zero when there are ERROR-severity violations, and this
 * rule is `warn` -- but a sibling rule going red must not make this check throw
 * something unreadable instead of reporting its own result, so the exit code is
 * ignored and the JSON is what is trusted. `maxBuffer` is raised because the
 * full graph is several megabytes and the default 1MB truncates it into a parse
 * error that reads like a depcruise bug.
 */
function violations(): readonly IDepcruiseViolation[] {
  const bin = join(rootDir, "node_modules", ".bin", "depcruise");
  let stdout: string;
  try {
    stdout = execFileSync(
      bin,
      ["src", "--config", ".dependency-cruiser.cjs", "--output-type", "json"],
      { cwd: rootDir, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 },
    );
  } catch (error) {
    const result = error as { stdout?: string };
    if (typeof result.stdout !== "string" || result.stdout.length === 0) {
      throw error;
    }
    stdout = result.stdout;
  }
  const parsed: unknown = JSON.parse(stdout);
  const summary = (parsed as { summary?: { violations?: unknown } }).summary;
  if (!Array.isArray(summary?.violations)) {
    throw new Error(
      "dependency-cruiser returned no `summary.violations` array -- its JSON " +
        "shape changed, or the run produced no output",
    );
  }
  return summary.violations as readonly IDepcruiseViolation[];
}

async function main(): Promise<void> {
  const mode = GeneratedMarkdown.requireMode(process.argv[2]);

  const sites = ParseTreeSites.sites(violations());
  const document = await GeneratedMarkdown.format(
    ParseTreeSites.render(sites),
    docPath,
  );

  if (mode === "write") {
    // `write` still refuses to run on an empty population: regenerating a doc
    // to zero rows is how a rule that stopped matching gets its baseline
    // rewritten to agree with it, which would license deleting the gate.
    const empty = ParseTreeSites.emptinessError(sites);
    if (empty !== null) {
      console.error(chalk.red(empty));
      process.exit(1);
    }
    writeFileSync(docPath, document);
    console.log(chalk.green(`Wrote ${docPath} (${sites.length} module(s))`));
    return;
  }

  // Every decision -- emptiness, missing file, population drift, staleness and
  // the ordering between them -- is made in `ParseTreeSites.checkOutcome` so a
  // test can reach it. This function only prints and sets the exit code, which
  // is the shape `diagnostic-manifest.ts` settled on and the one #1317 should
  // have copied.
  const outcome = ParseTreeSites.checkOutcome(
    existsSync(docPath) ? readFileSync(docPath, "utf-8") : null,
    sites,
    document,
  );

  for (const line of outcome.info) {
    console.log(chalk.green(line));
  }
  if (!outcome.ok) {
    console.error(chalk.red(outcome.errors.join("\n")));
    process.exit(1);
  }
}

void main();
