#!/usr/bin/env tsx
/**
 * Issue #1403: ADRs must survive a rewrite of the transpiler in another stack.
 *
 * Reports what it is NOT checking on every run. A gate that prints only its
 * successes is how `npm run coverage:matrix:check` came to say "satisfied" over
 * four ADRs while 49 had declared nothing (#1406); this one names its
 * exemptions every time so the number cannot drift out of view.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import chalk from "chalk";

import AdrIndependence from "./adr-independence/AdrIndependence";
import ADR_INDEPENDENCE_BASELINE from "./adr-independence/baseline";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

const outcome = AdrIndependence.run(rootDir, ADR_INDEPENDENCE_BASELINE);

for (const violation of outcome.failures) {
  console.log(
    `${chalk.red("error")}  ${violation.file}:${violation.line}  ${violation.kind}  ${violation.detail}`,
  );
}

for (const file of outcome.stale) {
  console.log(
    `${chalk.red("error")}  ${file} is in the baseline but has no violations -- remove it`,
  );
}

const exemptTotal = outcome.exempt.reduce((sum, entry) => sum + entry.count, 0);
console.log(
  `Scanned ${outcome.scanned} ADR(s). ${chalk.yellow(
    `${outcome.exempt.length} exempt`,
  )} carrying ${exemptTotal} known violation(s); these are NOT checked.`,
);

if (outcome.failures.length > 0 || outcome.stale.length > 0) {
  console.log(
    chalk.red(
      `\nRewrite test failed: ${outcome.failures.length} violation(s), ${outcome.stale.length} stale baseline entries.`,
    ),
  );
  console.log("What an ADR may contain: docs/decisions/README.md");
  process.exit(1);
}

console.log(chalk.green("Rewrite test passed for every non-exempt ADR."));
