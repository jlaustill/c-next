#!/usr/bin/env tsx
/**
 * C-Next Coverage Tracking Tool
 *
 * Maps coverage.md checkboxes to test file annotations,
 * providing visibility into test coverage status.
 *
 * Usage:
 *   npm run coverage:check   - Show coverage report (default)
 *   npm run coverage:report  - Generate markdown report
 *   npm run coverage:gaps    - Show only untested items
 *   npm run coverage:ids     - List all coverage IDs
 */

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

import coverageParser from "./coverage-parser";
import testScanner from "./test-scanner";
import reportGenerator from "./report-generator";
import Colors from "./colors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

function printUsage(): void {
  console.log(`
Usage: tsx scripts/coverage-checker.ts <mode>

Modes:
  check   - Display coverage report (default)
  report  - Generate COVERAGE-STATUS.md file
  gaps    - Show only untested items
  ids     - List all coverage IDs for annotation

Options:
  --help  - Show this help message
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const mode = args[0] || "check";

  if (args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  const coveragePath = join(rootDir, "coverage.md");
  const testsDir = join(rootDir, "tests");
  const reportPath = join(rootDir, "COVERAGE-STATUS.md");

  // Verify paths exist
  if (!existsSync(coveragePath)) {
    console.error(
      Colors.red(`Error: coverage.md not found at ${coveragePath}`),
    );
    process.exit(1);
  }

  if (!existsSync(testsDir)) {
    console.error(
      Colors.red(`Error: tests/ directory not found at ${testsDir}`),
    );
    process.exit(1);
  }

  // Parse coverage.md
  console.log(Colors.yellow("Parsing coverage.md..."));
  const coverageItems = coverageParser.parseCoverageDocument(coveragePath);
  console.log(`  Found ${coverageItems.length} coverage items`);

  // Check for duplicate IDs
  const duplicates = coverageParser.checkForDuplicates(coverageItems);
  if (duplicates.size > 0) {
    console.log(
      Colors.yellow(`Warning: ${duplicates.size} duplicate IDs found:`),
    );
    for (const [id, lines] of duplicates) {
      console.log(`  - "${id}" at lines ${lines.join(", ")}`);
    }
  }

  // Scan test files for annotations
  console.log(Colors.yellow("Scanning test files..."));
  const annotations = testScanner.scanTestFiles(testsDir);
  console.log(`  Found ${annotations.length} coverage annotations`);

  // Build report
  const report = reportGenerator.buildReport(coverageItems, annotations);

  // Execute requested mode
  switch (mode) {
    case "check":
      reportGenerator.generateConsoleReport(report);
      if (report.mismatches.length > 0) {
        process.exit(1);
      }
      break;

    case "report":
      reportGenerator.generateMarkdownReport(report, reportPath);
      console.log(Colors.green(`Report written to ${reportPath}`));
      break;

    case "gaps":
      reportGenerator.generateGapsReport(report);
      break;

    case "ids":
      reportGenerator.listAllIds(coverageItems);
      break;

    default:
      console.error(Colors.red(`Unknown mode: ${mode}`));
      printUsage();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(Colors.red(`Error: ${err.message}`));
  process.exit(1);
});
