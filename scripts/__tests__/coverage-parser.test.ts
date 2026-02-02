/**
 * Unit tests for coverage-parser.ts
 *
 * Tests all parsing functions for coverage.md file format.
 */

import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import coverageParser from "../coverage-parser";

describe("toKebabCase", () => {
  it("should convert simple string to kebab-case", () => {
    expect(coverageParser.toKebabCase("Hello World")).toBe("hello-world");
  });

  it("should handle multiple spaces", () => {
    expect(coverageParser.toKebabCase("Hello   World")).toBe("hello-world");
  });

  it("should remove special characters", () => {
    expect(coverageParser.toKebabCase("Hello! World?")).toBe("hello-world");
  });

  it("should handle numbers", () => {
    expect(coverageParser.toKebabCase("u8 Variable 123")).toBe(
      "u8-variable-123",
    );
  });

  it("should trim leading and trailing hyphens", () => {
    expect(coverageParser.toKebabCase("  Hello World  ")).toBe("hello-world");
  });

  it("should remove error marker", () => {
    expect(coverageParser.toKebabCase("Some **(error)** test")).toBe(
      "some-test",
    );
  });

  it("should handle case-insensitive error marker", () => {
    expect(coverageParser.toKebabCase("Test **(ERROR)** case")).toBe(
      "test-case",
    );
  });

  it("should collapse multiple hyphens", () => {
    expect(coverageParser.toKebabCase("Hello---World")).toBe("hello-world");
  });

  it("should handle empty string", () => {
    expect(coverageParser.toKebabCase("")).toBe("");
  });

  it("should handle string with only special characters", () => {
    expect(coverageParser.toKebabCase("!!!")).toBe("");
  });
});

describe("extractSectionNumber", () => {
  it("should extract section number from heading", () => {
    expect(coverageParser.extractSectionNumber("## 1. Primitive Types")).toBe(
      "1",
    );
  });

  it("should extract multi-digit section number", () => {
    expect(
      coverageParser.extractSectionNumber("## 12. Advanced Features"),
    ).toBe("12");
  });

  it("should return empty string for non-numbered heading", () => {
    expect(coverageParser.extractSectionNumber("## Table of Contents")).toBe(
      "",
    );
  });

  it("should return empty string for subsection heading", () => {
    expect(
      coverageParser.extractSectionNumber("### 1.1 Unsigned Integers"),
    ).toBe("");
  });

  it("should return empty string for invalid format", () => {
    expect(coverageParser.extractSectionNumber("Not a heading")).toBe("");
  });
});

describe("extractSubsectionNumber", () => {
  it("should extract subsection number from heading", () => {
    expect(
      coverageParser.extractSubsectionNumber("### 1.1 Unsigned Integers"),
    ).toBe("1");
  });

  it("should extract multi-digit subsection number", () => {
    expect(
      coverageParser.extractSubsectionNumber("### 5.12 Complex Types"),
    ).toBe("12");
  });

  it("should return empty string for section heading", () => {
    expect(
      coverageParser.extractSubsectionNumber("## 1. Primitive Types"),
    ).toBe("");
  });

  it("should return empty string for type header", () => {
    expect(coverageParser.extractSubsectionNumber("#### u8")).toBe("");
  });

  it("should return empty string for plain text", () => {
    expect(coverageParser.extractSubsectionNumber("Some text")).toBe("");
  });
});

describe("extractSectionTitle", () => {
  it("should extract full section title", () => {
    expect(coverageParser.extractSectionTitle("## 1. Primitive Types")).toBe(
      "1. Primitive Types",
    );
  });

  it("should trim whitespace", () => {
    expect(coverageParser.extractSectionTitle("##   1. Types   ")).toBe(
      "1. Types",
    );
  });

  it("should handle non-numbered sections", () => {
    expect(coverageParser.extractSectionTitle("## Table of Contents")).toBe(
      "Table of Contents",
    );
  });

  it("should match subsection heading (regex only checks ##)", () => {
    // Note: The regex /^##\s*(.+)$/ also matches ### headings since ## is a prefix
    // The parser logic handles level distinction, not this function
    expect(coverageParser.extractSectionTitle("### 1.1 Subsection")).toBe(
      "# 1.1 Subsection",
    );
  });

  it("should return empty for plain text", () => {
    expect(coverageParser.extractSectionTitle("Not a heading")).toBe("");
  });
});

describe("extractSubsectionTitle", () => {
  it("should extract full subsection title", () => {
    expect(
      coverageParser.extractSubsectionTitle("### 1.1 Unsigned Integers"),
    ).toBe("1.1 Unsigned Integers");
  });

  it("should trim whitespace", () => {
    expect(coverageParser.extractSubsectionTitle("###   1.2 Types   ")).toBe(
      "1.2 Types",
    );
  });

  it("should return empty for section headings", () => {
    expect(coverageParser.extractSubsectionTitle("## 1. Section")).toBe("");
  });

  it("should match type header (regex only checks ###)", () => {
    // Note: The regex /^###\s*(.+)$/ also matches #### headings since ### is a prefix
    // The parser logic handles level distinction, not this function
    expect(coverageParser.extractSubsectionTitle("#### u8")).toBe("# u8");
  });
});

describe("extractTypeHeader", () => {
  it("should extract type from header", () => {
    expect(coverageParser.extractTypeHeader("#### u8")).toBe("u8");
  });

  it("should extract multi-character type", () => {
    expect(coverageParser.extractTypeHeader("#### string")).toBe("string");
  });

  it("should only extract first word", () => {
    expect(coverageParser.extractTypeHeader("#### u8 (unsigned)")).toBe("u8");
  });

  it("should trim whitespace", () => {
    expect(coverageParser.extractTypeHeader("####   i32   ")).toBe("i32");
  });

  it("should return empty for non-type headers", () => {
    expect(coverageParser.extractTypeHeader("### 1.1 Subsection")).toBe("");
  });

  it("should return empty for section headers", () => {
    expect(coverageParser.extractTypeHeader("## 1. Section")).toBe("");
  });
});

describe("parseTableRow", () => {
  const baseParams = {
    sectionNum: "1",
    section: "1. Primitive Types",
    subsectionNum: "1",
    subsection: "1.1 Unsigned Integers",
    lineNumber: 10,
  };

  it("should parse tested row with test file", () => {
    const line = "| Global variable declaration | [x] | `u8.test.cnx` |";
    const result = coverageParser.parseTableRow(
      line,
      baseParams.sectionNum,
      baseParams.section,
      baseParams.subsectionNum,
      baseParams.subsection,
      "u8",
      baseParams.lineNumber,
    );

    expect(result).not.toBeNull();
    expect(result!.tested).toBe(true);
    expect(result!.context).toBe("Global variable declaration");
    expect(result!.testFile).toBe("u8.test.cnx");
    expect(result!.typeHeader).toBe("u8");
    expect(result!.lineNumber).toBe(10);
    expect(result!.isErrorTest).toBe(false);
  });

  it("should parse untested row", () => {
    const line = "| Local variable | [ ] | |";
    const result = coverageParser.parseTableRow(
      line,
      baseParams.sectionNum,
      baseParams.section,
      baseParams.subsectionNum,
      baseParams.subsection,
      "u16",
      baseParams.lineNumber,
    );

    expect(result).not.toBeNull();
    expect(result!.tested).toBe(false);
    expect(result!.context).toBe("Local variable");
    expect(result!.testFile).toBeUndefined();
  });

  it("should parse row without type header", () => {
    const line = "| Function call | [x] | `test.cnx` |";
    const result = coverageParser.parseTableRow(
      line,
      baseParams.sectionNum,
      baseParams.section,
      baseParams.subsectionNum,
      baseParams.subsection,
      undefined,
      baseParams.lineNumber,
    );

    expect(result).not.toBeNull();
    expect(result!.typeHeader).toBeUndefined();
    expect(result!.id).toBe("1.1-function-call");
  });

  it("should detect error test marker", () => {
    const line = "| **(ERROR)** Invalid syntax | [x] | `error.test.cnx` |";
    const result = coverageParser.parseTableRow(
      line,
      baseParams.sectionNum,
      baseParams.section,
      baseParams.subsectionNum,
      baseParams.subsection,
      undefined,
      baseParams.lineNumber,
    );

    expect(result).not.toBeNull();
    expect(result!.isErrorTest).toBe(true);
    expect(result!.context).toBe("Invalid syntax");
  });

  it("should skip header row with Status", () => {
    const line = "| Context | Status | Test File |";
    const result = coverageParser.parseTableRow(
      line,
      baseParams.sectionNum,
      baseParams.section,
      baseParams.subsectionNum,
      baseParams.subsection,
      undefined,
      baseParams.lineNumber,
    );

    expect(result).toBeNull();
  });

  it("should skip separator row with dashes", () => {
    const line = "|---------|--------|-----------|";
    const result = coverageParser.parseTableRow(
      line,
      baseParams.sectionNum,
      baseParams.section,
      baseParams.subsectionNum,
      baseParams.subsection,
      undefined,
      baseParams.lineNumber,
    );

    expect(result).toBeNull();
  });

  it("should return null for row without checkbox", () => {
    const line = "| Some content | maybe | test |";
    const result = coverageParser.parseTableRow(
      line,
      baseParams.sectionNum,
      baseParams.section,
      baseParams.subsectionNum,
      baseParams.subsection,
      undefined,
      baseParams.lineNumber,
    );

    expect(result).toBeNull();
  });

  it("should return null for row with too few columns", () => {
    const line = "| Single column |";
    const result = coverageParser.parseTableRow(
      line,
      baseParams.sectionNum,
      baseParams.section,
      baseParams.subsectionNum,
      baseParams.subsection,
      undefined,
      baseParams.lineNumber,
    );

    expect(result).toBeNull();
  });
});

describe("generateCoverageId", () => {
  it("should generate ID with type header", () => {
    const id = coverageParser.generateCoverageId(
      "1",
      "1",
      "u8",
      "Global variable declaration",
    );
    expect(id).toBe("1.1-u8-global-variable-declaration");
  });

  it("should generate ID without type header", () => {
    const id = coverageParser.generateCoverageId(
      "2",
      "3",
      undefined,
      "Function call",
    );
    expect(id).toBe("2.3-function-call");
  });

  it("should handle special characters in context", () => {
    const id = coverageParser.generateCoverageId(
      "1",
      "1",
      "i32",
      "Array[index] access!",
    );
    expect(id).toBe("1.1-i32-array-index-access");
  });

  it("should lowercase type header", () => {
    const id = coverageParser.generateCoverageId(
      "1",
      "1",
      "U32",
      "Test context",
    );
    expect(id).toBe("1.1-u32-test-context");
  });
});

describe("shouldSkipSection", () => {
  it("should skip Table of Contents", () => {
    expect(coverageParser.shouldSkipSection("Table of Contents")).toBe(true);
  });

  it("should skip How to Use This Document", () => {
    expect(coverageParser.shouldSkipSection("How to Use This Document")).toBe(
      true,
    );
  });

  it("should skip Recent Updates", () => {
    expect(coverageParser.shouldSkipSection("Recent Updates")).toBe(true);
  });

  it("should skip Statistics", () => {
    expect(coverageParser.shouldSkipSection("Statistics")).toBe(true);
  });

  it("should skip Priority Summary", () => {
    expect(coverageParser.shouldSkipSection("Priority Summary")).toBe(true);
  });

  it("should skip Coverage by Test File", () => {
    expect(coverageParser.shouldSkipSection("Coverage by Test File")).toBe(
      true,
    );
  });

  it("should be case insensitive", () => {
    expect(coverageParser.shouldSkipSection("TABLE OF CONTENTS")).toBe(true);
  });

  it("should not skip numbered sections", () => {
    expect(coverageParser.shouldSkipSection("1. Primitive Types")).toBe(false);
  });

  it("should not skip regular content sections", () => {
    expect(coverageParser.shouldSkipSection("Control Flow")).toBe(false);
  });
});

describe("checkForDuplicates", () => {
  it("should return empty map when no duplicates", () => {
    const items = [
      { id: "1.1-u8-test", lineNumber: 10 },
      { id: "1.1-u16-test", lineNumber: 20 },
      { id: "1.2-i32-test", lineNumber: 30 },
    ] as Parameters<typeof coverageParser.checkForDuplicates>[0];

    const duplicates = coverageParser.checkForDuplicates(items);
    expect(duplicates.size).toBe(0);
  });

  it("should detect duplicate IDs", () => {
    const items = [
      { id: "1.1-u8-test", lineNumber: 10 },
      { id: "1.1-u8-test", lineNumber: 25 },
      { id: "1.2-i32-test", lineNumber: 30 },
    ] as Parameters<typeof coverageParser.checkForDuplicates>[0];

    const duplicates = coverageParser.checkForDuplicates(items);
    expect(duplicates.size).toBe(1);
    expect(duplicates.get("1.1-u8-test")).toEqual([10, 25]);
  });

  it("should detect multiple occurrences of same ID", () => {
    const items = [
      { id: "1.1-u8-test", lineNumber: 10 },
      { id: "1.1-u8-test", lineNumber: 20 },
      { id: "1.1-u8-test", lineNumber: 30 },
    ] as Parameters<typeof coverageParser.checkForDuplicates>[0];

    const duplicates = coverageParser.checkForDuplicates(items);
    expect(duplicates.size).toBe(1);
    expect(duplicates.get("1.1-u8-test")).toEqual([10, 20, 30]);
  });

  it("should handle empty array", () => {
    const duplicates = coverageParser.checkForDuplicates([]);
    expect(duplicates.size).toBe(0);
  });
});

describe("parseCoverageDocument", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "coverage-parser-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should parse a minimal coverage document", () => {
    const content = `# Coverage Document

## 1. Primitive Types

### 1.1 Unsigned Integers

#### u8

| Context | Status | Test File |
|---------|--------|-----------|
| Global variable declaration | [x] | \`u8.test.cnx\` |
| Local variable | [ ] | |
`;
    const filePath = join(tempDir, "coverage.md");
    writeFileSync(filePath, content);

    const items = coverageParser.parseCoverageDocument(filePath);

    expect(items).toHaveLength(2);
    expect(items[0].id).toBe("1.1-u8-global-variable-declaration");
    expect(items[0].tested).toBe(true);
    expect(items[0].testFile).toBe("u8.test.cnx");
    expect(items[1].id).toBe("1.1-u8-local-variable");
    expect(items[1].tested).toBe(false);
  });

  it("should skip non-numbered sections", () => {
    const content = `# Coverage

## Table of Contents

| Context | Status | Test |
|---------|--------|------|
| Should be skipped | [x] | |

## 1. Real Section

### 1.1 Subsection

| Context | Status | Test |
|---------|--------|------|
| Should be included | [x] | |
`;
    const filePath = join(tempDir, "coverage.md");
    writeFileSync(filePath, content);

    const items = coverageParser.parseCoverageDocument(filePath);

    expect(items).toHaveLength(1);
    expect(items[0].context).toBe("Should be included");
  });

  it("should handle multiple sections and subsections", () => {
    const content = `# Coverage

## 1. Section One

### 1.1 Sub One

| Context | Status | Test |
|---------|--------|------|
| Item 1.1 | [x] | |

### 1.2 Sub Two

| Context | Status | Test |
|---------|--------|------|
| Item 1.2 | [ ] | |

## 2. Section Two

### 2.1 Sub One

| Context | Status | Test |
|---------|--------|------|
| Item 2.1 | [x] | |
`;
    const filePath = join(tempDir, "coverage.md");
    writeFileSync(filePath, content);

    const items = coverageParser.parseCoverageDocument(filePath);

    expect(items).toHaveLength(3);
    expect(items[0].section).toBe("1. Section One");
    expect(items[0].subsection).toBe("1.1 Sub One");
    expect(items[1].section).toBe("1. Section One");
    expect(items[1].subsection).toBe("1.2 Sub Two");
    expect(items[2].section).toBe("2. Section Two");
  });

  it("should handle items without type header", () => {
    const content = `# Coverage

## 1. Control Flow

### 1.1 Conditionals

| Context | Status | Test |
|---------|--------|------|
| If statement | [x] | |
`;
    const filePath = join(tempDir, "coverage.md");
    writeFileSync(filePath, content);

    const items = coverageParser.parseCoverageDocument(filePath);

    expect(items).toHaveLength(1);
    expect(items[0].typeHeader).toBeUndefined();
    expect(items[0].id).toBe("1.1-if-statement");
  });

  it("should detect error tests", () => {
    const content = `# Coverage

## 1. Errors

### 1.1 Syntax Errors

| Context | Status | Test |
|---------|--------|------|
| **(ERROR)** Invalid token | [x] | \`error.test.cnx\` |
`;
    const filePath = join(tempDir, "coverage.md");
    writeFileSync(filePath, content);

    const items = coverageParser.parseCoverageDocument(filePath);

    expect(items).toHaveLength(1);
    expect(items[0].isErrorTest).toBe(true);
    expect(items[0].context).toBe("Invalid token");
  });

  it("should track correct line numbers", () => {
    const content = `# Coverage

## 1. Types

### 1.1 Integers

| Context | Status | Test |
|---------|--------|------|
| First item | [x] | |
| Second item | [ ] | |
`;
    const filePath = join(tempDir, "coverage.md");
    writeFileSync(filePath, content);

    const items = coverageParser.parseCoverageDocument(filePath);

    expect(items).toHaveLength(2);
    expect(items[0].lineNumber).toBe(9);
    expect(items[1].lineNumber).toBe(10);
  });

  it("should return empty array for document with no items", () => {
    const content = `# Coverage

## Table of Contents

Nothing here

## Statistics

Also nothing
`;
    const filePath = join(tempDir, "coverage.md");
    writeFileSync(filePath, content);

    const items = coverageParser.parseCoverageDocument(filePath);

    expect(items).toHaveLength(0);
  });
});
