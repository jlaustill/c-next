/**
 * Report generator for coverage analysis
 * Generates console and markdown reports
 */

import { writeFileSync } from "node:fs";
import ICoverageItem from "./types/ICoverageItem";
import ITestAnnotation from "./types/ITestAnnotation";
import ICoverageReport, {
  ICoverageSummary,
  IMismatch,
  ISectionSummary,
} from "./types/ICoverageReport";
import chalk from "chalk";

/** Get color function based on percentage threshold */
function getPercentageColor(pct: number): (text: string) => string {
  if (pct >= 80) return chalk.green;
  if (pct >= 50) return chalk.yellow;
  return chalk.red;
}

/**
 * Build a complete coverage report
 */
function buildReport(
  items: ICoverageItem[],
  annotations: ITestAnnotation[],
): ICoverageReport {
  // Create a map of coverage IDs to items
  const itemMap = new Map<string, ICoverageItem>();
  for (const item of items) {
    itemMap.set(item.id, item);
  }

  // Create a map of coverage IDs to annotations
  const annotationMap = new Map<string, ITestAnnotation[]>();
  for (const annotation of annotations) {
    const existing = annotationMap.get(annotation.coverageId) || [];
    existing.push(annotation);
    annotationMap.set(annotation.coverageId, existing);
  }

  // Find mismatches
  const mismatches: IMismatch[] = [];

  // Check for annotations with unknown IDs
  for (const annotation of annotations) {
    if (!itemMap.has(annotation.coverageId)) {
      mismatches.push({
        annotation,
        issue: `Unknown coverage ID "${annotation.coverageId}" in ${annotation.relativePath}:${annotation.lineNumber}`,
        type: "unknown_id",
      });
    }
  }

  // Check for status mismatches (annotation exists but not marked tested)
  for (const [id, annotationList] of annotationMap) {
    const item = itemMap.get(id);
    if (item && !item.tested) {
      mismatches.push({
        coverageItem: item,
        annotation: annotationList[0],
        issue: `Item "${id}" has annotation but is marked [ ] in coverage.md (line ${item.lineNumber})`,
        type: "status_mismatch",
      });
    }
  }

  // Find gaps (untested items)
  const gaps = items.filter((item) => !item.tested);

  // Count annotated items (items that have at least one annotation)
  const annotatedIds = new Set(annotations.map((a) => a.coverageId));
  const annotatedItems = items.filter((item) => annotatedIds.has(item.id));

  // Build section summaries
  const sectionMap = new Map<string, ICoverageItem[]>();
  for (const item of items) {
    const existing = sectionMap.get(item.section) || [];
    existing.push(item);
    sectionMap.set(item.section, existing);
  }

  const sections: ISectionSummary[] = [];
  for (const [name, sectionItems] of sectionMap) {
    const tested = sectionItems.filter((i) => i.tested).length;
    const annotated = sectionItems.filter((i) => annotatedIds.has(i.id)).length;
    sections.push({
      name,
      total: sectionItems.length,
      tested,
      annotated,
      percentage: Math.round((tested / sectionItems.length) * 100),
    });
  }

  // Sort sections by section number
  sections.sort((a, b) => {
    const numA = Number.parseInt(a.name.match(/^(\d+)/)?.[1] || "0");
    const numB = Number.parseInt(b.name.match(/^(\d+)/)?.[1] || "0");
    return numA - numB;
  });

  // Build summary
  const summary: ICoverageSummary = {
    totalItems: items.length,
    testedItems: items.filter((i) => i.tested).length,
    untestedItems: gaps.length,
    annotatedItems: annotatedItems.length,
    mismatchCount: mismatches.length,
    coveragePercentage: Math.round(
      (items.filter((i) => i.tested).length / items.length) * 100,
    ),
    sections,
  };

  return {
    generated: new Date(),
    summary,
    items,
    annotations,
    mismatches,
    gaps,
  };
}

/**
 * Generate console report
 */
function generateConsoleReport(report: ICoverageReport): void {
  const { summary, mismatches, gaps } = report;

  console.log("");
  console.log(
    chalk.bold("═══════════════════════════════════════════════════════"),
  );
  console.log(chalk.bold("  C-Next Coverage Tracking Report"));
  console.log(
    chalk.bold("═══════════════════════════════════════════════════════"),
  );
  console.log("");

  // Summary
  console.log(chalk.cyan("Summary:"));
  console.log(
    `  Total Coverage Points:  ${chalk.bold(String(summary.totalItems))}`,
  );
  console.log(
    `  Tested (coverage.md):   ${chalk.green(String(summary.testedItems))} (${summary.coveragePercentage}%)`,
  );
  console.log(
    `  With Annotations:       ${chalk.blue(String(summary.annotatedItems))}`,
  );
  console.log(
    `  Gaps Remaining:         ${chalk.yellow(String(summary.untestedItems))}`,
  );
  console.log("");

  // Section breakdown
  console.log(chalk.cyan("Section Breakdown:"));
  for (const section of summary.sections) {
    const pctColor = getPercentageColor(section.percentage);
    const sectionDisplay = section.name.substring(0, 35).padEnd(35);
    console.log(
      `  ${sectionDisplay} ${pctColor(`${section.tested}/${section.total}`)} (${section.percentage}%)`,
    );
  }
  console.log("");

  // Mismatches
  if (mismatches.length > 0) {
    console.log(chalk.red(`Mismatches Found: ${mismatches.length}`));
    for (const mismatch of mismatches.slice(0, 10)) {
      console.log(`  ${chalk.yellow("⚠")}  ${mismatch.issue}`);
    }
    if (mismatches.length > 10) {
      console.log(chalk.dim(`  ... and ${mismatches.length - 10} more`));
    }
    console.log("");
  } else {
    console.log(chalk.green("No mismatches found."));
    console.log("");
  }

  // Top gaps
  if (gaps.length > 0) {
    console.log(chalk.cyan("Top 10 Gaps:"));
    for (const gap of gaps.slice(0, 10)) {
      console.log(`  ${chalk.dim("[ ]")} ${gap.id}`);
    }
    if (gaps.length > 10) {
      console.log(
        chalk.dim(`  ... and ${gaps.length - 10} more untested items`),
      );
    }
  }

  console.log("");
}

/**
 * Generate gaps-only report
 */
function generateGapsReport(report: ICoverageReport): void {
  const { gaps } = report;

  console.log("");
  console.log(chalk.bold(`Coverage Gaps (${gaps.length} untested items)`));
  console.log("");

  // Group by section
  const bySection = new Map<string, ICoverageItem[]>();
  for (const gap of gaps) {
    const existing = bySection.get(gap.section) || [];
    existing.push(gap);
    bySection.set(gap.section, existing);
  }

  // Sort sections
  const sortedSections = Array.from(bySection.keys()).sort((a, b) => {
    const numA = Number.parseInt(a.match(/^(\d+)/)?.[1] || "0");
    const numB = Number.parseInt(b.match(/^(\d+)/)?.[1] || "0");
    return numA - numB;
  });

  for (const section of sortedSections) {
    const sectionGaps = bySection.get(section)!;
    console.log(`${chalk.cyan(section)} (${sectionGaps.length} gaps)`);
    for (const gap of sectionGaps) {
      console.log(`  [ ] ${gap.id}`);
    }
    console.log("");
  }
}

/**
 * Generate markdown report file
 */
function generateMarkdownReport(
  report: ICoverageReport,
  outputPath: string,
): void {
  const { summary, mismatches, gaps } = report;
  const lines: string[] = [];

  lines.push(
    "# C-Next Coverage Report",
    "",
    `Generated: ${report.generated.toISOString().split("T")[0]}`,
    "",
    // Summary table
    "## Summary",
    "",
    "| Metric | Count | Percentage |",
    "|--------|-------|------------|",
    `| Total Points | ${summary.totalItems} | 100% |`,
    `| Tested | ${summary.testedItems} | ${summary.coveragePercentage}% |`,
    `| With Annotations | ${summary.annotatedItems} | - |`,
    `| Gaps | ${summary.untestedItems} | - |`,
    "",
    // Section breakdown
    "## Section Breakdown",
    "",
    "| Section | Tested | Total | Coverage |",
    "|---------|--------|-------|----------|",
  );
  for (const section of summary.sections) {
    lines.push(
      `| ${section.name} | ${section.tested} | ${section.total} | ${section.percentage}% |`,
    );
  }
  lines.push("");

  // Mismatches
  if (mismatches.length > 0) {
    lines.push("## Mismatches", "", "| Type | Issue |", "|------|-------|");
    for (const mismatch of mismatches) {
      lines.push(`| ${mismatch.type} | ${mismatch.issue} |`);
    }
    lines.push("");
  }

  // Gaps by section
  lines.push("## Gaps by Section", "");

  const bySection = new Map<string, ICoverageItem[]>();
  for (const gap of gaps) {
    const existing = bySection.get(gap.section) || [];
    existing.push(gap);
    bySection.set(gap.section, existing);
  }

  const sortedSections = Array.from(bySection.keys()).sort((a, b) => {
    const numA = Number.parseInt(a.match(/^(\d+)/)?.[1] || "0");
    const numB = Number.parseInt(b.match(/^(\d+)/)?.[1] || "0");
    return numA - numB;
  });

  for (const section of sortedSections) {
    const sectionGaps = bySection.get(section)!;
    lines.push(`### ${section}`, "");
    for (const gap of sectionGaps) {
      lines.push(`- [ ] \`${gap.id}\``);
    }
    lines.push("");
  }

  writeFileSync(outputPath, lines.join("\n"));
}

/**
 * List all coverage IDs (for adding annotations)
 */
function listAllIds(items: ICoverageItem[]): void {
  console.log("");
  console.log(chalk.bold(`All Coverage IDs (${items.length} total)`));
  console.log("");

  // Group by section
  const bySection = new Map<string, ICoverageItem[]>();
  for (const item of items) {
    const existing = bySection.get(item.section) || [];
    existing.push(item);
    bySection.set(item.section, existing);
  }

  const sortedSections = Array.from(bySection.keys()).sort((a, b) => {
    const numA = Number.parseInt(a.match(/^(\d+)/)?.[1] || "0");
    const numB = Number.parseInt(b.match(/^(\d+)/)?.[1] || "0");
    return numA - numB;
  });

  for (const section of sortedSections) {
    const sectionItems = bySection.get(section)!;
    console.log(chalk.cyan(section));
    for (const item of sectionItems) {
      const status = item.tested ? chalk.green("[x]") : chalk.dim("[ ]");
      console.log(`  ${status} ${item.id}`);
    }
    console.log("");
  }
}

const reportGenerator = {
  buildReport,
  generateConsoleReport,
  generateGapsReport,
  generateMarkdownReport,
  listAllIds,
  // Exported for testing
  getPercentageColor,
};

export default reportGenerator;
