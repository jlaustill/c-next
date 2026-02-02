/**
 * Unit tests for test-scanner.ts
 *
 * Tests coverage annotation extraction from test files.
 */

import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import testScanner from "../test-scanner";

describe("extractAnnotations", () => {
  it("should extract single annotation from content", () => {
    const content = `// Test file
/* test-coverage: 1.1-u8-global-variable */
void test() {}
`;
    const annotations = testScanner.extractAnnotations(
      content,
      "/tests/test.test.cnx",
      "/tests",
    );

    expect(annotations).toHaveLength(1);
    expect(annotations[0].coverageId).toBe("1.1-u8-global-variable");
    expect(annotations[0].testFile).toBe("/tests/test.test.cnx");
    expect(annotations[0].relativePath).toBe("test.test.cnx");
    expect(annotations[0].lineNumber).toBe(2);
  });

  it("should extract multiple annotations from same line", () => {
    const content = `/* test-coverage: 1.1-a, 1.1-b, 1.1-c */
void test() {}
`;
    const annotations = testScanner.extractAnnotations(
      content,
      "/tests/test.cnx",
      "/tests",
    );

    expect(annotations).toHaveLength(3);
    expect(annotations[0].coverageId).toBe("1.1-a");
    expect(annotations[1].coverageId).toBe("1.1-b");
    expect(annotations[2].coverageId).toBe("1.1-c");
  });

  it("should extract annotations from multiple lines", () => {
    const content = `/* test-coverage: 1.1-first */
void test1() {}

/* test-coverage: 2.1-second */
void test2() {}
`;
    const annotations = testScanner.extractAnnotations(
      content,
      "/tests/test.cnx",
      "/tests",
    );

    expect(annotations).toHaveLength(2);
    expect(annotations[0].coverageId).toBe("1.1-first");
    expect(annotations[0].lineNumber).toBe(1);
    expect(annotations[1].coverageId).toBe("2.1-second");
    expect(annotations[1].lineNumber).toBe(4);
  });

  it("should handle whitespace in annotation", () => {
    const content = `/*   test-coverage:   1.1-test   */`;
    const annotations = testScanner.extractAnnotations(
      content,
      "/tests/test.cnx",
      "/tests",
    );

    expect(annotations).toHaveLength(1);
    expect(annotations[0].coverageId).toBe("1.1-test");
  });

  it("should handle whitespace in comma-separated list", () => {
    const content = `/* test-coverage: 1.1-a ,  1.1-b  , 1.1-c */`;
    const annotations = testScanner.extractAnnotations(
      content,
      "/tests/test.cnx",
      "/tests",
    );

    expect(annotations).toHaveLength(3);
    expect(annotations[0].coverageId).toBe("1.1-a");
    expect(annotations[1].coverageId).toBe("1.1-b");
    expect(annotations[2].coverageId).toBe("1.1-c");
  });

  it("should return empty array for content without annotations", () => {
    const content = `// Just a regular test file
void test() {}
`;
    const annotations = testScanner.extractAnnotations(
      content,
      "/tests/test.cnx",
      "/tests",
    );

    expect(annotations).toHaveLength(0);
  });

  it("should not extract from line comments", () => {
    const content = `// test-coverage: 1.1-should-not-match
void test() {}
`;
    const annotations = testScanner.extractAnnotations(
      content,
      "/tests/test.cnx",
      "/tests",
    );

    expect(annotations).toHaveLength(0);
  });

  it("should handle complex coverage IDs", () => {
    const content = `/* test-coverage: 1.1-u8-global-variable-declaration */
/* test-coverage: 2.3-i32-array-index-access */
`;
    const annotations = testScanner.extractAnnotations(
      content,
      "/tests/test.cnx",
      "/tests",
    );

    expect(annotations).toHaveLength(2);
    expect(annotations[0].coverageId).toBe(
      "1.1-u8-global-variable-declaration",
    );
    expect(annotations[1].coverageId).toBe("2.3-i32-array-index-access");
  });

  it("should handle relative path calculation", () => {
    const content = `/* test-coverage: 1.1-test */`;
    const annotations = testScanner.extractAnnotations(
      content,
      "/workspace/tests/subdir/test.test.cnx",
      "/workspace/tests",
    );

    expect(annotations[0].relativePath).toBe("subdir/test.test.cnx");
  });

  it("should skip empty IDs in comma-separated list", () => {
    const content = `/* test-coverage: 1.1-a, , 1.1-b */`;
    const annotations = testScanner.extractAnnotations(
      content,
      "/tests/test.cnx",
      "/tests",
    );

    expect(annotations).toHaveLength(2);
    expect(annotations[0].coverageId).toBe("1.1-a");
    expect(annotations[1].coverageId).toBe("1.1-b");
  });

  it("should handle multiple annotations on same line", () => {
    const content = `/* test-coverage: 1.1-a */ void foo(); /* test-coverage: 1.1-b */`;
    const annotations = testScanner.extractAnnotations(
      content,
      "/tests/test.cnx",
      "/tests",
    );

    expect(annotations).toHaveLength(2);
    expect(annotations[0].coverageId).toBe("1.1-a");
    expect(annotations[1].coverageId).toBe("1.1-b");
    // Both should report same line number
    expect(annotations[0].lineNumber).toBe(1);
    expect(annotations[1].lineNumber).toBe(1);
  });

  it("should handle empty content", () => {
    const annotations = testScanner.extractAnnotations(
      "",
      "/tests/test.cnx",
      "/tests",
    );

    expect(annotations).toHaveLength(0);
  });
});

describe("findTestFiles", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "test-scanner-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should find .test.cnx files in directory", () => {
    writeFileSync(join(tempDir, "one.test.cnx"), "// test");
    writeFileSync(join(tempDir, "two.test.cnx"), "// test");
    writeFileSync(join(tempDir, "not-a-test.cnx"), "// not a test");

    const files = testScanner.findTestFiles(tempDir);

    expect(files).toHaveLength(2);
    expect(files.some((f) => f.endsWith("one.test.cnx"))).toBe(true);
    expect(files.some((f) => f.endsWith("two.test.cnx"))).toBe(true);
  });

  it("should find files in subdirectories", () => {
    const subdir = join(tempDir, "subdir");
    mkdirSync(subdir);
    writeFileSync(join(tempDir, "root.test.cnx"), "// test");
    writeFileSync(join(subdir, "nested.test.cnx"), "// test");

    const files = testScanner.findTestFiles(tempDir);

    expect(files).toHaveLength(2);
    expect(files.some((f) => f.endsWith("root.test.cnx"))).toBe(true);
    expect(files.some((f) => f.endsWith("nested.test.cnx"))).toBe(true);
  });

  it("should find files in deeply nested directories", () => {
    const deepDir = join(tempDir, "a", "b", "c");
    mkdirSync(deepDir, { recursive: true });
    writeFileSync(join(deepDir, "deep.test.cnx"), "// test");

    const files = testScanner.findTestFiles(tempDir);

    expect(files).toHaveLength(1);
    expect(files[0]).toContain("deep.test.cnx");
  });

  it("should return empty array for directory with no test files", () => {
    writeFileSync(join(tempDir, "regular.cnx"), "// not a test");
    writeFileSync(join(tempDir, "readme.md"), "# Readme");

    const files = testScanner.findTestFiles(tempDir);

    expect(files).toHaveLength(0);
  });

  it("should return empty array for empty directory", () => {
    const files = testScanner.findTestFiles(tempDir);

    expect(files).toHaveLength(0);
  });

  it("should ignore non-.test.cnx files", () => {
    writeFileSync(join(tempDir, "test.cnx"), "// not a test file");
    writeFileSync(join(tempDir, "test.c"), "// c file");
    writeFileSync(join(tempDir, "test.test.c"), "// wrong extension");
    writeFileSync(join(tempDir, "actual.test.cnx"), "// test file");

    const files = testScanner.findTestFiles(tempDir);

    expect(files).toHaveLength(1);
    expect(files[0]).toContain("actual.test.cnx");
  });
});

describe("scanTestFiles", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "scan-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should scan directory and extract all annotations", () => {
    writeFileSync(
      join(tempDir, "one.test.cnx"),
      `/* test-coverage: 1.1-first */
void test() {}
`,
    );
    writeFileSync(
      join(tempDir, "two.test.cnx"),
      `/* test-coverage: 2.1-second, 2.1-third */
void test() {}
`,
    );

    const annotations = testScanner.scanTestFiles(tempDir);

    expect(annotations).toHaveLength(3);
    expect(annotations.some((a) => a.coverageId === "1.1-first")).toBe(true);
    expect(annotations.some((a) => a.coverageId === "2.1-second")).toBe(true);
    expect(annotations.some((a) => a.coverageId === "2.1-third")).toBe(true);
  });

  it("should handle directory with no test files", () => {
    writeFileSync(join(tempDir, "not-a-test.cnx"), "// nothing");

    const annotations = testScanner.scanTestFiles(tempDir);

    expect(annotations).toHaveLength(0);
  });

  it("should handle test files without annotations", () => {
    writeFileSync(
      join(tempDir, "empty.test.cnx"),
      `// No annotations here
void test() {}
`,
    );

    const annotations = testScanner.scanTestFiles(tempDir);

    expect(annotations).toHaveLength(0);
  });

  it("should scan subdirectories", () => {
    const subdir = join(tempDir, "subdir");
    mkdirSync(subdir);
    writeFileSync(
      join(subdir, "nested.test.cnx"),
      `/* test-coverage: 1.1-nested */`,
    );

    const annotations = testScanner.scanTestFiles(tempDir);

    expect(annotations).toHaveLength(1);
    expect(annotations[0].coverageId).toBe("1.1-nested");
    expect(annotations[0].relativePath).toBe("subdir/nested.test.cnx");
  });
});
