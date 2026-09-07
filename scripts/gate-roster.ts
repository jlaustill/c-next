#!/usr/bin/env tsx
/**
 * Issue #1526: make CLAUDE.md's gate roster derived rather than asserted.
 *
 * The roster claimed a count it could not verify, and the command it named as
 * "the count that cannot drift" was wrong twice in ways that cancelled. This is
 * the executable form of the claim, following `gh-pagination.ts`: there is no
 * exemption mechanism, because a gate that can be opted out of eventually is.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import chalk from "chalk";

import GateRoster from "./gate-roster/GateRoster";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

const outcome = GateRoster.evaluate(
  readFileSync(join(rootDir, "scripts", "gate.sh"), "utf-8"),
  readFileSync(join(rootDir, ".github", "workflows", "pr-checks.yml"), "utf-8"),
  readFileSync(join(rootDir, "CLAUDE.md"), "utf-8"),
);

for (const violation of outcome.violations) {
  console.log(`${chalk.red("error")}  ${violation.kind}  ${violation.detail}`);
}

console.log(
  `gate.sh runs ${outcome.checkCount} check(s) over ${outcome.gateScripts.length} npm script(s); ` +
    `pr-checks.yml runs ${outcome.workflowScripts.length}, with ${outcome.exclusions.length} excluded by name.`,
);

// A parser that finds nothing reports a clean repository, which is the exact
// failure this check exists to catch -- one level up. `gh-pagination.ts` guards
// the same way for the same reason. An empty scan is broken, never clean.
if (outcome.checkCount === 0 || outcome.workflowScripts.length === 0) {
  console.log(
    chalk.red(
      "\nParsed 0 checks or 0 workflow scripts: a broken selector reporting a clean roster.",
    ),
  );
  process.exit(1);
}

if (outcome.violations.length > 0) {
  console.log(
    chalk.red(
      `\nGate roster is out of date: ${outcome.violations.length} violation(s).`,
    ),
  );
  console.log(
    "Fix by editing scripts/gate.sh (add the check, or add a `# not-in-gate:` line with a reason)",
  );
  console.log(
    "and CLAUDE.md's roster paragraph, which must name every check and state the right count.",
  );
  process.exit(1);
}

console.log(chalk.green("Gate roster matches what runs."));
