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

import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

import coverageParser from "./coverage-parser";
import scanTestFiles from "./test-scanner";
import reportGenerator from "./report-generator";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

// ANSI colors
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
};

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
      `${colors.red}Error: coverage.md not found at ${coveragePath}${colors.reset}`,
    );
    process.exit(1);
  }

  if (!existsSync(testsDir)) {
    console.error(
      `${colors.red}Error: tests/ directory not found at ${testsDir}${colors.reset}`,
    );
    process.exit(1);
  }

  // Parse coverage.md
  console.log(`${colors.yellow}Parsing coverage.md...${colors.reset}`);
  const coverageItems = coverageParser.parseCoverageDocument(coveragePath);
  console.log(`  Found ${coverageItems.length} coverage items`);

  // Check for duplicate IDs
  const duplicates = coverageParser.checkForDuplicates(coverageItems);
  if (duplicates.size > 0) {
    console.log(
      `${colors.yellow}Warning: ${duplicates.size} duplicate IDs found:${colors.reset}`,
    );
    for (const [id, lines] of duplicates) {
      console.log(`  - "${id}" at lines ${lines.join(", ")}`);
    }
  }

  // Scan test files for annotations
  console.log(`${colors.yellow}Scanning test files...${colors.reset}`);
  const annotations = scanTestFiles(testsDir);
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
      console.log(
        `${colors.green}Report written to ${reportPath}${colors.reset}`,
      );
      break;

    case "gaps":
      reportGenerator.generateGapsReport(report);
      break;

    case "ids":
      reportGenerator.listAllIds(coverageItems);
      break;

    default:
      console.error(`${colors.red}Unknown mode: ${mode}${colors.reset}`);
      printUsage();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`${colors.red}Error: ${err.message}${colors.reset}`);
  process.exit(1);
});
