/**
 * Unit tests for report-generator.ts
 *
 * Tests report building and formatting logic.
 */

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import reportGenerator from "../report-generator";
import ICoverageItem from "../types/ICoverageItem";
import ITestAnnotation from "../types/ITestAnnotation";

describe("getPercentageColor", () => {
  it("should return green for percentage >= 80", () => {
    expect(reportGenerator.getPercentageColor(80)).toBe(
      reportGenerator.colors.green,
    );
    expect(reportGenerator.getPercentageColor(100)).toBe(
      reportGenerator.colors.green,
    );
    expect(reportGenerator.getPercentageColor(95)).toBe(
      reportGenerator.colors.green,
    );
  });

  it("should return yellow for percentage >= 50 and < 80", () => {
    expect(reportGenerator.getPercentageColor(50)).toBe(
      reportGenerator.colors.yellow,
    );
    expect(reportGenerator.getPercentageColor(79)).toBe(
      reportGenerator.colors.yellow,
    );
    expect(reportGenerator.getPercentageColor(65)).toBe(
      reportGenerator.colors.yellow,
    );
  });

  it("should return red for percentage < 50", () => {
    expect(reportGenerator.getPercentageColor(49)).toBe(
      reportGenerator.colors.red,
    );
    expect(reportGenerator.getPercentageColor(0)).toBe(
      reportGenerator.colors.red,
    );
    expect(reportGenerator.getPercentageColor(25)).toBe(
      reportGenerator.colors.red,
    );
  });
});

describe("buildReport", () => {
  const createItem = (
    id: string,
    section: string,
    tested: boolean,
  ): ICoverageItem => ({
    id,
    section,
    subsection: "1.1 Subsection",
    context: "Test context",
    tested,
    lineNumber: 10,
    isErrorTest: false,
  });

  const createAnnotation = (
    coverageId: string,
    testFile: string,
  ): ITestAnnotation => ({
    coverageId,
    testFile: `/tests/${testFile}`,
    relativePath: testFile,
    lineNumber: 5,
  });

  it("should build report with correct summary totals", () => {
    const items: ICoverageItem[] = [
      createItem("1.1-test1", "1. Section", true),
      createItem("1.1-test2", "1. Section", true),
      createItem("1.1-test3", "1. Section", false),
    ];
    const annotations: ITestAnnotation[] = [];

    const report = reportGenerator.buildReport(items, annotations);

    expect(report.summary.totalItems).toBe(3);
    expect(report.summary.testedItems).toBe(2);
    expect(report.summary.untestedItems).toBe(1);
    expect(report.summary.coveragePercentage).toBe(67);
  });

  it("should identify untested items as gaps", () => {
    const items: ICoverageItem[] = [
      createItem("1.1-tested", "1. Section", true),
      createItem("1.1-untested1", "1. Section", false),
      createItem("1.1-untested2", "1. Section", false),
    ];

    const report = reportGenerator.buildReport(items, []);

    expect(report.gaps).toHaveLength(2);
    expect(report.gaps[0].id).toBe("1.1-untested1");
    expect(report.gaps[1].id).toBe("1.1-untested2");
  });

  it("should count annotated items", () => {
    const items: ICoverageItem[] = [
      createItem("1.1-item1", "1. Section", true),
      createItem("1.1-item2", "1. Section", true),
      createItem("1.1-item3", "1. Section", false),
    ];
    const annotations: ITestAnnotation[] = [
      createAnnotation("1.1-item1", "test1.cnx"),
      createAnnotation("1.1-item2", "test2.cnx"),
    ];

    const report = reportGenerator.buildReport(items, annotations);

    expect(report.summary.annotatedItems).toBe(2);
  });

  it("should detect unknown coverage IDs in annotations", () => {
    const items: ICoverageItem[] = [
      createItem("1.1-known", "1. Section", true),
    ];
    const annotations: ITestAnnotation[] = [
      createAnnotation("1.1-unknown", "test.cnx"),
    ];

    const report = reportGenerator.buildReport(items, annotations);

    expect(report.mismatches).toHaveLength(1);
    expect(report.mismatches[0].type).toBe("unknown_id");
    expect(report.mismatches[0].issue).toContain("Unknown coverage ID");
  });

  it("should detect status mismatch (annotation exists but not marked tested)", () => {
    const items: ICoverageItem[] = [
      createItem("1.1-item", "1. Section", false), // Not marked as tested
    ];
    const annotations: ITestAnnotation[] = [
      createAnnotation("1.1-item", "test.cnx"), // But has annotation
    ];

    const report = reportGenerator.buildReport(items, annotations);

    expect(report.mismatches).toHaveLength(1);
    expect(report.mismatches[0].type).toBe("status_mismatch");
    expect(report.mismatches[0].issue).toContain(
      "has annotation but is marked [ ]",
    );
  });

  it("should build section summaries", () => {
    const items: ICoverageItem[] = [
      createItem("1.1-a", "1. First Section", true),
      createItem("1.1-b", "1. First Section", false),
      createItem("2.1-a", "2. Second Section", true),
      createItem("2.1-b", "2. Second Section", true),
    ];

    const report = reportGenerator.buildReport(items, []);

    expect(report.summary.sections).toHaveLength(2);

    const section1 = report.summary.sections.find((s) =>
      s.name.includes("First"),
    );
    expect(section1).toBeDefined();
    expect(section1!.total).toBe(2);
    expect(section1!.tested).toBe(1);
    expect(section1!.percentage).toBe(50);

    const section2 = report.summary.sections.find((s) =>
      s.name.includes("Second"),
    );
    expect(section2).toBeDefined();
    expect(section2!.total).toBe(2);
    expect(section2!.tested).toBe(2);
    expect(section2!.percentage).toBe(100);
  });

  it("should sort sections by section number", () => {
    const items: ICoverageItem[] = [
      createItem("10.1-a", "10. Tenth Section", true),
      createItem("2.1-a", "2. Second Section", true),
      createItem("1.1-a", "1. First Section", true),
    ];

    const report = reportGenerator.buildReport(items, []);

    expect(report.summary.sections[0].name).toBe("1. First Section");
    expect(report.summary.sections[1].name).toBe("2. Second Section");
    expect(report.summary.sections[2].name).toBe("10. Tenth Section");
  });

  it("should include generated timestamp", () => {
    const report = reportGenerator.buildReport([], []);

    expect(report.generated).toBeInstanceOf(Date);
  });

  it("should handle empty items and annotations", () => {
    const report = reportGenerator.buildReport([], []);

    expect(report.summary.totalItems).toBe(0);
    expect(report.summary.testedItems).toBe(0);
    expect(report.summary.untestedItems).toBe(0);
    expect(report.summary.annotatedItems).toBe(0);
    expect(report.gaps).toHaveLength(0);
    expect(report.mismatches).toHaveLength(0);
  });

  it("should handle multiple annotations for same coverage ID", () => {
    const items: ICoverageItem[] = [
      createItem("1.1-item", "1. Section", false),
    ];
    const annotations: ITestAnnotation[] = [
      createAnnotation("1.1-item", "test1.cnx"),
      createAnnotation("1.1-item", "test2.cnx"),
    ];

    const report = reportGenerator.buildReport(items, annotations);

    // Should only count one mismatch even with multiple annotations
    expect(report.mismatches).toHaveLength(1);
    // Annotated count should be 1 (one unique item is annotated)
    expect(report.summary.annotatedItems).toBe(1);
  });

  it("should track annotated count per section", () => {
    const items: ICoverageItem[] = [
      createItem("1.1-a", "1. Section", true),
      createItem("1.1-b", "1. Section", true),
    ];
    const annotations: ITestAnnotation[] = [
      createAnnotation("1.1-a", "test.cnx"),
    ];

    const report = reportGenerator.buildReport(items, annotations);

    expect(report.summary.sections[0].annotated).toBe(1);
  });
});

describe("generateMarkdownReport", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "report-gen-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should generate markdown file with summary table", () => {
    const items: ICoverageItem[] = [
      {
        id: "1.1-test",
        section: "1. Section",
        subsection: "1.1 Sub",
        context: "Test",
        tested: true,
        lineNumber: 10,
        isErrorTest: false,
      },
    ];
    const report = reportGenerator.buildReport(items, []);
    const outputPath = join(tempDir, "report.md");

    reportGenerator.generateMarkdownReport(report, outputPath);

    const content = readFileSync(outputPath, "utf-8");
    expect(content).toContain("# C-Next Coverage Report");
    expect(content).toContain("## Summary");
    expect(content).toContain("| Total Points | 1 | 100% |");
    expect(content).toContain("| Tested | 1 | 100% |");
  });

  it("should include section breakdown in markdown", () => {
    const items: ICoverageItem[] = [
      {
        id: "1.1-test",
        section: "1. Types",
        subsection: "1.1 Sub",
        context: "Test",
        tested: true,
        lineNumber: 10,
        isErrorTest: false,
      },
    ];
    const report = reportGenerator.buildReport(items, []);
    const outputPath = join(tempDir, "report.md");

    reportGenerator.generateMarkdownReport(report, outputPath);

    const content = readFileSync(outputPath, "utf-8");
    expect(content).toContain("## Section Breakdown");
    expect(content).toContain("| 1. Types | 1 | 1 | 100% |");
  });

  it("should include mismatches section when present", () => {
    const items: ICoverageItem[] = [];
    const annotations: ITestAnnotation[] = [
      {
        coverageId: "unknown-id",
        testFile: "/test.cnx",
        relativePath: "test.cnx",
        lineNumber: 5,
      },
    ];
    const report = reportGenerator.buildReport(items, annotations);
    const outputPath = join(tempDir, "report.md");

    reportGenerator.generateMarkdownReport(report, outputPath);

    const content = readFileSync(outputPath, "utf-8");
    expect(content).toContain("## Mismatches");
    expect(content).toContain("unknown_id");
  });

  it("should not include mismatches section when none exist", () => {
    const items: ICoverageItem[] = [];
    const report = reportGenerator.buildReport(items, []);
    const outputPath = join(tempDir, "report.md");

    reportGenerator.generateMarkdownReport(report, outputPath);

    const content = readFileSync(outputPath, "utf-8");
    expect(content).not.toContain("## Mismatches");
  });

  it("should include gaps by section", () => {
    const items: ICoverageItem[] = [
      {
        id: "1.1-gap",
        section: "1. Section",
        subsection: "1.1 Sub",
        context: "Gap item",
        tested: false,
        lineNumber: 10,
        isErrorTest: false,
      },
    ];
    const report = reportGenerator.buildReport(items, []);
    const outputPath = join(tempDir, "report.md");

    reportGenerator.generateMarkdownReport(report, outputPath);

    const content = readFileSync(outputPath, "utf-8");
    expect(content).toContain("## Gaps by Section");
    expect(content).toContain("### 1. Section");
    expect(content).toContain("- [ ] `1.1-gap`");
  });

  it("should include generation date", () => {
    const report = reportGenerator.buildReport([], []);
    const outputPath = join(tempDir, "report.md");

    reportGenerator.generateMarkdownReport(report, outputPath);

    const content = readFileSync(outputPath, "utf-8");
    // Should have date in YYYY-MM-DD format
    expect(content).toMatch(/Generated: \d{4}-\d{2}-\d{2}/);
  });
});
