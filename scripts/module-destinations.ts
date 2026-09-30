#!/usr/bin/env tsx
/**
 * `npm run destinations:check` (#1653): every non-test module under `src/` has
 * a decided row in `docs/architecture/module-destinations.md`, and the set of
 * `awaiting` rows does not grow. The rules are `ModuleDestinations`'.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

import chalk from "chalk";

import AWAITING_ROWS from "./module-destinations/AWAITING_ROWS";
import ModuleDestinations from "./module-destinations/ModuleDestinations";
import IModuleDestinationFailure from "./types/IModuleDestinationFailure";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

const HINTS: Record<IModuleDestinationFailure["kind"], string> = {
  "unresolvable-row":
    "the row names no path under src/: give its section a `src/.../` heading, or spell the path from src/",
  "no-row":
    "no row places this module: add one saying which pass owns it and why",
  "conflicting-rows":
    "one row places this module and another says it moves: keep the one that is true",
  "unmatched-row":
    "this row matches no module: it moved or was deleted, so update or remove the row",
  "awaiting-grew":
    "the `awaiting` set grew, a new row or a module under an existing one (ruling 17): decide a real destination",
  "baseline-stale": `AWAITING_ROWS.ts allows more than the map now awaits: lower the count, or delete the entry`,
};

// The working tree, not `git ls-files`: the index cannot see a module that is
// not staged yet, and still lists one that is deleted but not yet staged, so a
// local run would miss exactly the change this exists to catch. No `.ts` under
// `src/` is gitignored, so on a CI checkout the two agree.
const files = readdirSync(join(rootDir, "src"), { recursive: true })
  .map((file) => `src/${String(file).split(sep).join("/")}`)
  .sort();

const outcome = ModuleDestinations.checkOutcome(
  readFileSync(join(rootDir, ModuleDestinations.MAP_PATH), "utf-8"),
  files,
  AWAITING_ROWS,
);

for (const failure of outcome.failures) {
  const where =
    failure.line === null
      ? ""
      : `${ModuleDestinations.MAP_PATH}:${failure.line}  `;
  console.log(
    `${chalk.red("error")}  ${where}${failure.kind}  ${failure.subject}${failure.detail ? ` (${failure.detail})` : ""}\n       ${HINTS[failure.kind]}`,
  );
}

console.log(
  `${outcome.modules} module(s), ${outcome.rows} row(s), ${outcome.awaiting} awaiting.`,
);

if (outcome.failures.length > 0) {
  console.log(
    chalk.red(`\ndestinations:check failed: ${outcome.failures.length}.`),
  );
  process.exit(1);
}

console.log(chalk.green("Every module under src/ has a decided destination."));
