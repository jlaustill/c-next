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

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import chalk from "chalk";
import prettier from "prettier";

import AdrMatrixDeclaration from "./matrix/AdrMatrixDeclaration";
import FixtureOccupancy from "./matrix/FixtureOccupancy";
import MatrixRenderer from "./matrix/MatrixRenderer";
import MatrixReport from "./matrix/MatrixReport";
import FileScanner from "./utils/FileScanner";
import IMatrixDeclaration from "./types/IMatrixDeclaration";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const decisionsDir = join(rootDir, "docs", "decisions");
const testsDir = join(rootDir, "tests");
const reportPath = join(rootDir, "docs", "scope-context-matrix.md");
const searchPaths = [join(testsDir, "include")];

/** Every ADR's declared matrix, keyed by zero-padded number. */
function readDeclarations(): Map<string, IMatrixDeclaration> {
  const declarations = new Map<string, IMatrixDeclaration>();
  if (!existsSync(decisionsDir)) return declarations;

  for (const entry of readdirSync(decisionsDir).sort()) {
    const match = /^adr-(\d{3})-.*\.md$/.exec(entry);
    if (match === null) continue;
    const markdown = readFileSync(join(decisionsDir, entry), "utf-8");
    const declaration = AdrMatrixDeclaration.parse(markdown, match[1]);
    // Only ADRs that actually declare a matrix take part.
    if (declaration.severities.size === 0 && declaration.errors.length === 0) {
      continue;
    }
    declarations.set(match[1], declaration);
  }
  return declarations;
}

/**
 * Format through Prettier before writing or comparing.
 *
 * The pre-commit hook formats staged markdown, so a generator emitting
 * unformatted output would produce a committed file that never matches what it
 * generates -- making the check fail permanently in CI.
 */
async function formatMarkdown(markdown: string): Promise<string> {
  const config = await prettier.resolveConfig(reportPath);
  return prettier.format(markdown, {
    ...config,
    filepath: reportPath,
    parser: "markdown",
  });
}

async function render(): Promise<{
  document: string;
  declarations: Map<string, IMatrixDeclaration>;
  occupancy: ReturnType<typeof FixtureOccupancy.build>;
  declarationErrors: string[];
}> {
  const declarations = readDeclarations();
  const fixtures = existsSync(testsDir)
    ? FileScanner.findTestFiles(testsDir)
    : [];
  const occupancy = FixtureOccupancy.build(fixtures, testsDir, searchPaths);
  const declarationErrors = [...declarations.values()].flatMap((d) => d.errors);
  const document = await formatMarkdown(
    MatrixRenderer.renderDocument(declarations, occupancy),
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
    if (errors.length > 0) printViolations(errors);
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
  console.log(chalk.green("Scope-context matrix is satisfied"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
