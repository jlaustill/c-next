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

// ANSI color codes for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

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
    `${colors.bright}═══════════════════════════════════════════════════════${colors.reset}`,
  );
  console.log(
    `${colors.bright}  C-Next Coverage Tracking Report${colors.reset}`,
  );
  console.log(
    `${colors.bright}═══════════════════════════════════════════════════════${colors.reset}`,
  );
  console.log("");

  // Summary
  console.log(`${colors.cyan}Summary:${colors.reset}`);
  console.log(
    `  Total Coverage Points:  ${colors.bright}${summary.totalItems}${colors.reset}`,
  );
  console.log(
    `  Tested (coverage.md):   ${colors.green}${summary.testedItems}${colors.reset} (${summary.coveragePercentage}%)`,
  );
  console.log(
    `  With Annotations:       ${colors.blue}${summary.annotatedItems}${colors.reset}`,
  );
  console.log(
    `  Gaps Remaining:         ${colors.yellow}${summary.untestedItems}${colors.reset}`,
  );
  console.log("");

  // Section breakdown
  console.log(`${colors.cyan}Section Breakdown:${colors.reset}`);
  for (const section of summary.sections) {
    const pctColor =
      section.percentage >= 80
        ? colors.green
        : section.percentage >= 50
          ? colors.yellow
          : colors.red;
    const sectionDisplay = section.name.substring(0, 35).padEnd(35);
    console.log(
      `  ${sectionDisplay} ${pctColor}${section.tested}/${section.total}${colors.reset} (${section.percentage}%)`,
    );
  }
  console.log("");

  // Mismatches
  if (mismatches.length > 0) {
    console.log(
      `${colors.red}Mismatches Found: ${mismatches.length}${colors.reset}`,
    );
    for (const mismatch of mismatches.slice(0, 10)) {
      console.log(`  ${colors.yellow}⚠${colors.reset}  ${mismatch.issue}`);
    }
    if (mismatches.length > 10) {
      console.log(
        `  ${colors.dim}... and ${mismatches.length - 10} more${colors.reset}`,
      );
    }
    console.log("");
  } else {
    console.log(`${colors.green}No mismatches found.${colors.reset}`);
    console.log("");
  }

  // Top gaps
  if (gaps.length > 0) {
    console.log(`${colors.cyan}Top 10 Gaps:${colors.reset}`);
    for (const gap of gaps.slice(0, 10)) {
      console.log(`  ${colors.dim}[ ]${colors.reset} ${gap.id}`);
    }
    if (gaps.length > 10) {
      console.log(
        `  ${colors.dim}... and ${gaps.length - 10} more untested items${colors.reset}`,
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
  console.log(
    `${colors.bright}Coverage Gaps (${gaps.length} untested items)${colors.reset}`,
  );
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
    console.log(
      `${colors.cyan}${section}${colors.reset} (${sectionGaps.length} gaps)`,
    );
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

  lines.push("# C-Next Coverage Report");
  lines.push("");
  lines.push(`Generated: ${report.generated.toISOString().split("T")[0]}`);
  lines.push("");

  // Summary table
  lines.push("## Summary");
  lines.push("");
  lines.push("| Metric | Count | Percentage |");
  lines.push("|--------|-------|------------|");
  lines.push(`| Total Points | ${summary.totalItems} | 100% |`);
  lines.push(
    `| Tested | ${summary.testedItems} | ${summary.coveragePercentage}% |`,
  );
  lines.push(`| With Annotations | ${summary.annotatedItems} | - |`);
  lines.push(`| Gaps | ${summary.untestedItems} | - |`);
  lines.push("");

  // Section breakdown
  lines.push("## Section Breakdown");
  lines.push("");
  lines.push("| Section | Tested | Total | Coverage |");
  lines.push("|---------|--------|-------|----------|");
  for (const section of summary.sections) {
    lines.push(
      `| ${section.name} | ${section.tested} | ${section.total} | ${section.percentage}% |`,
    );
  }
  lines.push("");

  // Mismatches
  if (mismatches.length > 0) {
    lines.push("## Mismatches");
    lines.push("");
    lines.push("| Type | Issue |");
    lines.push("|------|-------|");
    for (const mismatch of mismatches) {
      lines.push(`| ${mismatch.type} | ${mismatch.issue} |`);
    }
    lines.push("");
  }

  // Gaps by section
  lines.push("## Gaps by Section");
  lines.push("");

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
    lines.push(`### ${section}`);
    lines.push("");
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
  console.log(
    `${colors.bright}All Coverage IDs (${items.length} total)${colors.reset}`,
  );
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
    console.log(`${colors.cyan}${section}${colors.reset}`);
    for (const item of sectionItems) {
      const status = item.tested ? colors.green + "[x]" : colors.dim + "[ ]";
      console.log(`  ${status}${colors.reset} ${item.id}`);
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
};

export default reportGenerator;
