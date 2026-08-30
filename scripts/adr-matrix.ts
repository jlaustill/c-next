#!/usr/bin/env tsx
/**
 * Issue #1219: the scope-context test matrix.
 *
 * Modes are write / check / console, following
 * `scripts/toolchain-requirements.ts` rather than `grammar-coverage.ts`: the
 * latter's `check` never writes and never diffs, which is why
 * GRAMMAR-COVERAGE.md drifted for seven months (#1150). `check` here
 * regenerates in memory, diffs against what is committed, AND enforces the
 * declared obligations.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import chalk from "chalk";

import AdrDeclarationReader from "./matrix/AdrDeclarationReader";
import FixtureOccupancy from "./matrix/FixtureOccupancy";
import MatrixRenderer from "./matrix/MatrixRenderer";
import MatrixReport from "./matrix/MatrixReport";
import FileScanner from "./utils/FileScanner";
import IMatrixDeclaration from "./types/IMatrixDeclaration";
import GeneratedMarkdown from "./utils/GeneratedMarkdown";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const decisionsDir = join(rootDir, "docs", "decisions");
const testsDir = join(rootDir, "tests");
const reportPath = join(rootDir, "docs", "scope-context-matrix.md");
const searchPaths = [join(testsDir, "include")];

async function render(): Promise<{
  document: string;
  declarations: Map<string, IMatrixDeclaration>;
  occupancy: ReturnType<typeof FixtureOccupancy.build>;
  declarationErrors: string[];
}> {
  const declarations = AdrDeclarationReader.read(decisionsDir);
  const fixtures = existsSync(testsDir)
    ? FileScanner.findTestFiles(testsDir)
    : [];
  const occupancy = await FixtureOccupancy.build(
    fixtures,
    testsDir,
    searchPaths,
  );
  const declarationErrors = [...declarations.values()].flatMap((d) => d.errors);
  const document = await GeneratedMarkdown.format(
    MatrixRenderer.renderDocument(declarations, occupancy),
    reportPath,
  );
  return { document, declarations, occupancy, declarationErrors };
}

function printViolations(
  violations: ReturnType<typeof MatrixReport.violations>,
): void {
  for (const violation of violations) {
    const label =
      violation.severity === "error"
        ? chalk.red("error")
        : chalk.yellow("warn");
    console.log(
      `  ${label}  ADR-${violation.adr}  ${violation.context} / ${violation.relationship}`,
    );
  }
}

/**
 * Explain an empty `error` cell when the ADR's fixtures cannot be placed.
 *
 * Only a fixture with an `.expected.error` can occupy a cell today, so an ADR
 * covering codegen behavior (ADR-006, ADR-049) can declare `error` cells and
 * have real fixtures that still cannot satisfy them. Without this the gate is
 * red with no path to green and no explanation.
 */
function printContextNotDerivableHint(
  errors: ReturnType<typeof MatrixReport.violations>,
  occupancy: ReturnType<typeof FixtureOccupancy.build>,
): void {
  const affected = [
    ...new Set(errors.map((violation) => violation.adr)),
  ].filter(
    (adr) => (occupancy.get(adr)?.fixturesWithoutContext.length ?? 0) > 0,
  );
  if (affected.length === 0) return;

  console.error(
    chalk.yellow(
      `\nNote: ADR-${affected.join(", ADR-")} ` +
        `${affected.length === 1 ? "has" : "have"} linked fixtures whose context could not be derived.\n` +
        `Only a fixture with an .expected.error can occupy a cell today -- context comes from the\n` +
        `diagnostic's position. Codegen-only fixtures cannot satisfy a cell until #1241 lands.`,
    ),
  );
}

function printSummary(
  violations: ReturnType<typeof MatrixReport.violations>,
  pending: ReturnType<typeof MatrixReport.undeterminable>,
): void {
  const errors = violations.filter((v) => v.severity === "error").length;
  const warnings = violations.length - errors;
  console.log(
    `\n${errors} error, ${warnings} warn, ${pending.length} not yet derivable`,
  );
}

async function main(): Promise<void> {
  const mode = process.argv[2] ?? "console";

  if (!["write", "check", "console", "gaps"].includes(mode)) {
    console.error(`Unknown mode: ${mode}`);
    console.error(
      "Usage: tsx scripts/adr-matrix.ts [write|check|console|gaps]",
    );
    process.exit(1);
  }

  const { document, declarations, occupancy, declarationErrors } =
    await render();
  const violations = MatrixReport.violations(declarations, occupancy);
  const pending = MatrixReport.undeterminable(declarations);

  if (mode === "write") {
    writeFileSync(reportPath, document, "utf-8");
    console.log(chalk.green(`Wrote ${reportPath}`));
    return;
  }

  if (mode === "console" || mode === "gaps") {
    if (mode === "console") console.log(document);
    if (violations.length > 0) {
      console.log(chalk.bold("\nUnmet obligations:"));
      printViolations(violations);
    }
    printSummary(violations, pending);
    return;
  }

  // check
  const failures: string[] = [];

  if (declarationErrors.length > 0) {
    failures.push("Malformed MATRIX-SEVERITY table:");
    failures.push(...declarationErrors.map((error) => `  ${error}`));
  }

  const committed = existsSync(reportPath)
    ? readFileSync(reportPath, "utf-8")
    : "";
  if (committed !== document) {
    failures.push(
      "docs/scope-context-matrix.md is stale. Run: npm run coverage:matrix",
    );
  }

  const errors = violations.filter((v) => v.severity === "error");
  if (errors.length > 0) {
    failures.push(
      `${errors.length} cell(s) declared \`error\` are unoccupied:`,
    );
  }

  if (failures.length > 0) {
    console.error(chalk.red(failures.join("\n")));
    if (errors.length > 0) {
      printViolations(errors);
      printContextNotDerivableHint(errors, occupancy);
    }
    process.exit(1);
  }

  const warnings = violations.filter((v) => v.severity === "warn");
  if (warnings.length > 0) {
    console.log(
      chalk.yellow(
        `${warnings.length} cell(s) declared \`warn\` are unoccupied:`,
      ),
    );
    printViolations(warnings);
  }
  // Say what was enforced, not just that nothing failed. An identical
  // "satisfied" line for twelve obligations and for zero is what would let a
  // silently-emptied severity table pass unremarked in a CI log.
  console.log(
    chalk.green(
      `Scope-context matrix is satisfied ` +
        `(${declarations.size} ADR(s), ${MatrixReport.obligationCount(declarations)} obligation(s))`,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
