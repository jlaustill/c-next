#!/usr/bin/env tsx
/**
 * C-Next Grammar Coverage Tracker (Issue #35)
 *
 * Tracks which ANTLR grammar rules are executed during test runs
 * to identify dead grammar code and untested language constructs.
 *
 * Usage:
 *   npm run coverage:grammar         - Generate coverage report
 *   npm run coverage:grammar:check   - Check coverage (fail if below threshold)
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

import transpile from "../src/lib/transpiler";
import IGrammarCoverageReport from "../src/transpiler/logic/analysis/types/IGrammarCoverageReport";
import { CNextLexer } from "../src/transpiler/logic/parser/grammar/CNextLexer";
import { CNextParser } from "../src/transpiler/logic/parser/grammar/CNextParser";
import Colors from "./colors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

// Default coverage threshold (percentage)
const DEFAULT_THRESHOLD = 80;

/** Get color function based on percentage threshold */
function getPercentageColor(pct: number): (text: string) => string {
  if (pct >= 80) return Colors.green;
  if (pct >= 60) return Colors.yellow;
  return Colors.red;
}

/**
 * Recursively find all .test.cnx files
 */
function findTestFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string): void {
    const entries = readdirSync(currentDir);

    for (const entry of entries) {
      const fullPath = join(currentDir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (entry.endsWith(".test.cnx")) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

/**
 * Aggregate coverage from all test files
 */
function aggregateCoverage(testsDir: string): IGrammarCoverageReport {
  const testFiles = findTestFiles(testsDir);
  const parserVisits = new Map<string, number>();
  const lexerVisits = new Map<string, number>();

  for (const file of testFiles) {
    try {
      const source = readFileSync(file, "utf-8");
      const result = transpile(source, { collectGrammarCoverage: true });

      if (result.grammarCoverage) {
        for (const [rule, count] of result.grammarCoverage.parserRuleVisits) {
          const current = parserVisits.get(rule) || 0;
          parserVisits.set(rule, current + count);
        }
        for (const [rule, count] of result.grammarCoverage.lexerRuleVisits) {
          const current = lexerVisits.get(rule) || 0;
          lexerVisits.set(rule, current + count);
        }
      }
    } catch {
      // Already logged above
    }
  }

  const totalParserRules = CNextParser.ruleNames.length;
  const totalLexerRules = CNextLexer.ruleNames.length;
  const visitedParserRules = parserVisits.size;
  const visitedLexerRules = lexerVisits.size;

  const neverVisitedParserRules = CNextParser.ruleNames.filter(
    (name) => !parserVisits.has(name),
  );
  const neverVisitedLexerRules = CNextLexer.ruleNames.filter(
    (name) => !lexerVisits.has(name),
  );

  const parserCoveragePercentage =
    totalParserRules > 0 ? (visitedParserRules / totalParserRules) * 100 : 0;
  const lexerCoveragePercentage =
    totalLexerRules > 0 ? (visitedLexerRules / totalLexerRules) * 100 : 0;
  const combinedTotal = totalParserRules + totalLexerRules;
  const combinedVisited = visitedParserRules + visitedLexerRules;
  const combinedCoveragePercentage =
    combinedTotal > 0 ? (combinedVisited / combinedTotal) * 100 : 0;

  return {
    totalParserRules,
    totalLexerRules,
    visitedParserRules,
    visitedLexerRules,
    neverVisitedParserRules,
    neverVisitedLexerRules,
    parserRuleVisits: parserVisits,
    lexerRuleVisits: lexerVisits,
    parserCoveragePercentage,
    lexerCoveragePercentage,
    combinedCoveragePercentage,
  };
}

/**
 * Generate console report
 */
function generateConsoleReport(report: IGrammarCoverageReport): void {
  console.log("\n" + "=".repeat(50));
  console.log("  Grammar Rule Coverage Report");
  console.log("=".repeat(50) + "\n");

  // Summary
  console.log(Colors.cyan("Parser Rules:"));
  console.log(`  Total:    ${report.totalParserRules}`);
  console.log(
    `  Covered:  ${report.visitedParserRules} (${report.parserCoveragePercentage.toFixed(1)}%)`,
  );
  console.log(`  Missing:  ${report.neverVisitedParserRules.length}`);

  console.log(`\n${Colors.cyan("Lexer Rules (Token Types):")}`);
  console.log(`  Total:    ${report.totalLexerRules}`);
  console.log(
    `  Covered:  ${report.visitedLexerRules} (${report.lexerCoveragePercentage.toFixed(1)}%)`,
  );
  console.log(`  Missing:  ${report.neverVisitedLexerRules.length}`);

  console.log(`\n${Colors.cyan("Combined Coverage:")}`);
  const combinedColor = getPercentageColor(report.combinedCoveragePercentage);
  console.log(
    `  ${combinedColor(`${report.combinedCoveragePercentage.toFixed(1)}%`)}`,
  );

  // Top 10 most used parser rules
  console.log(`\n${Colors.cyan("Top 10 Most Used Parser Rules:")}`);
  const sortedParser = Array.from(report.parserRuleVisits.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  for (const [rule, count] of sortedParser) {
    console.log(`  ${rule.padEnd(35)} ${count.toLocaleString()} times`);
  }

  // Never visited parser rules
  if (report.neverVisitedParserRules.length > 0) {
    console.log(`\n${Colors.yellow("Never Visited Parser Rules:")}`);
    for (const rule of report.neverVisitedParserRules) {
      console.log(`  ${Colors.red("✗")} ${rule}`);
    }
  } else {
    console.log(`\n${Colors.green("✓ All parser rules covered!")}`);
  }

  // Never visited lexer rules (only show notable ones)
  const notableMissing = report.neverVisitedLexerRules.filter(
    (rule) =>
      !rule.startsWith("T__") && // Skip anonymous tokens
      rule !== "WS" && // Skip whitespace
      !rule.includes("COMMENT"), // Skip comments
  );

  if (notableMissing.length > 0) {
    console.log(`\n${Colors.yellow("Never Matched Lexer Rules (Notable):")}`);
    for (const rule of notableMissing.slice(0, 20)) {
      console.log(`  ${Colors.red("✗")} ${rule}`);
    }
    if (notableMissing.length > 20) {
      console.log(Colors.dim(`  ... and ${notableMissing.length - 20} more`));
    }
  }

  console.log("");
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(report: IGrammarCoverageReport): string {
  const lines: string[] = [];
  const timestamp = new Date().toISOString();

  lines.push(
    "# Grammar Rule Coverage Report",
    "",
    `> Generated: ${timestamp}`,
    "",
    // Summary
    "## Summary",
    "",
    "| Category | Total | Covered | Percentage |",
    "|----------|-------|---------|------------|",
    `| Parser Rules | ${report.totalParserRules} | ${report.visitedParserRules} | ${report.parserCoveragePercentage.toFixed(1)}% |`,
    `| Lexer Rules | ${report.totalLexerRules} | ${report.visitedLexerRules} | ${report.lexerCoveragePercentage.toFixed(1)}% |`,
    `| **Combined** | ${report.totalParserRules + report.totalLexerRules} | ${report.visitedParserRules + report.visitedLexerRules} | **${report.combinedCoveragePercentage.toFixed(1)}%** |`,
    "",
    // Parser rules coverage
    "## Parser Rules",
    "",
    "### Covered Parser Rules",
    "",
    "| Rule | Visit Count |",
    "|------|-------------|",
  );

  const sortedParser = Array.from(report.parserRuleVisits.entries()).sort(
    (a, b) => b[1] - a[1],
  );

  for (const [rule, count] of sortedParser) {
    lines.push(`| ${rule} | ${count.toLocaleString()} |`);
  }
  lines.push("");

  // Never visited parser rules
  if (report.neverVisitedParserRules.length > 0) {
    lines.push(
      "### Never Visited Parser Rules",
      "",
      "These parser rules were never executed during test runs. Consider adding tests for these language constructs.",
      "",
    );
    for (const rule of report.neverVisitedParserRules) {
      lines.push(`- [ ] \`${rule}\``);
    }
    lines.push("");
  } else {
    lines.push("### ✅ All Parser Rules Covered", "");
  }

  // Lexer rules coverage
  lines.push(
    "## Lexer Rules (Token Types)",
    "",
    "### Covered Lexer Rules",
    "",
    "| Rule | Match Count |",
    "|------|-------------|",
  );

  const sortedLexer = Array.from(report.lexerRuleVisits.entries()).sort(
    (a, b) => b[1] - a[1],
  );

  for (const [rule, count] of sortedLexer) {
    lines.push(`| ${rule} | ${count.toLocaleString()} |`);
  }
  lines.push("");

  // Never visited lexer rules
  if (report.neverVisitedLexerRules.length > 0) {
    lines.push(
      "### Never Matched Lexer Rules",
      "",
      "These token types were never matched during test runs. Some may be expected (comments, whitespace) while others may indicate missing test coverage.",
      "",
    );
    for (const rule of report.neverVisitedLexerRules) {
      lines.push(`- [ ] \`${rule}\``);
    }
    lines.push("");
  } else {
    lines.push("### ✅ All Lexer Rules Matched", "");
  }

  return lines.join("\n");
}

function printUsage(): void {
  console.log(`
Usage: tsx scripts/grammar-coverage.ts [mode] [options]

Modes:
  report    - Generate GRAMMAR-COVERAGE.md (default)
  check     - Check coverage and exit with error if below threshold
  console   - Print report to console only

Options:
  --threshold <N>  - Set minimum coverage percentage (default: ${DEFAULT_THRESHOLD})
  --help           - Show this help message
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  // Parse arguments
  let mode = "report";
  let threshold = DEFAULT_THRESHOLD;

  let skipNext = false;
  for (let i = 0; i < args.length; i++) {
    if (skipNext) {
      skipNext = false;
      continue;
    }
    const arg = args[i];
    if (arg === "--threshold" && i + 1 < args.length) {
      threshold = Number.parseFloat(args[i + 1]);
      skipNext = true;
    } else if (!arg.startsWith("--")) {
      mode = arg;
    }
  }

  const testsDir = join(rootDir, "tests");
  const reportPath = join(rootDir, "GRAMMAR-COVERAGE.md");

  console.log(Colors.yellow("Scanning test files for grammar coverage..."));

  const testFiles = findTestFiles(testsDir);
  console.log(`  Found ${testFiles.length} test files`);

  console.log(Colors.yellow("Aggregating grammar coverage..."));
  const report = aggregateCoverage(testsDir);

  switch (mode) {
    case "console":
      generateConsoleReport(report);
      break;

    case "check":
      generateConsoleReport(report);
      if (report.combinedCoveragePercentage < threshold) {
        console.error(
          Colors.red(
            `\nError: Grammar coverage (${report.combinedCoveragePercentage.toFixed(1)}%) is below threshold (${threshold}%)`,
          ),
        );
        process.exit(1);
      }
      console.log(
        Colors.green(`\n✓ Grammar coverage meets threshold (${threshold}%)`),
      );
      break;

    case "report":
    default:
      generateConsoleReport(report);
      const markdown = generateMarkdownReport(report);
      writeFileSync(reportPath, markdown, "utf-8");
      console.log(
        Colors.green(`Report written to ${relative(rootDir, reportPath)}`),
      );
      break;
  }
}

main().catch((err) => {
  console.error(Colors.red(`Error: ${err.message}`));
  process.exit(1);
});
