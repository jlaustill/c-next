/**
 * Tests for test-utils.ts shared module
 *
 * This test file is written BEFORE test-utils.ts exists (TDD approach).
 * It verifies the public API contract for the shared test utilities.
 */

import TestUtils from "./test-utils";

// Import shared types
import ITools from "./types/ITools";
import ITestResult from "./types/ITestResult";
import IValidationResult from "./types/IValidationResult";

describe("test-utils exports", () => {
  it("should export ITools interface", () => {
    // TypeScript compile-time check - just verify we can use the type
    const tools: ITools = {
      gcc: true,
      cppcheck: false,
      clangTidy: false,
      misra: false,
    };
    expect(tools.gcc).toBe(true);
  });

  it("should export ITestResult interface", () => {
    const result: ITestResult = {
      passed: true,
      message: "Test message",
    };
    expect(result.passed).toBe(true);
  });

  it("should export IValidationResult interface", () => {
    const result: IValidationResult = {
      valid: true,
      message: "Validation passed",
    };
    expect(result.valid).toBe(true);
  });
});

describe("normalize", () => {
  it("should trim trailing whitespace from each line", () => {
    const input = "line1   \nline2  \nline3";
    const expected = "line1\nline2\nline3";
    expect(TestUtils.normalize(input)).toBe(expected);
  });

  it("should normalize line endings", () => {
    const input = "line1\r\nline2\nline3\r\n";
    // After split on \n, \r remains at end of lines, trimEnd removes it
    const result = TestUtils.normalize(input);
    expect(result).not.toContain("\r");
  });

  it("should trim leading and trailing whitespace from the whole string", () => {
    const input = "  \n  content  \n  ";
    const result = TestUtils.normalize(input);
    expect(result).toBe("content");
  });

  it("should handle empty string", () => {
    expect(TestUtils.normalize("")).toBe("");
  });

  it("should handle single line", () => {
    expect(TestUtils.normalize("hello world  ")).toBe("hello world");
  });
});

describe("hasNoWarningsMarker", () => {
  it("should return true for source with /* test-no-warnings */ marker", () => {
    const source = "/* test-no-warnings */\nvoid main() {}";
    expect(TestUtils.hasNoWarningsMarker(source)).toBe(true);
  });

  it("should return true with extra whitespace in marker", () => {
    const source = "/*   test-no-warnings   */\nvoid main() {}";
    expect(TestUtils.hasNoWarningsMarker(source)).toBe(true);
  });

  it("should be case insensitive", () => {
    const source = "/* TEST-NO-WARNINGS */\nvoid main() {}";
    expect(TestUtils.hasNoWarningsMarker(source)).toBe(true);
  });

  it("should return false for source without marker", () => {
    const source = "void main() {}";
    expect(TestUtils.hasNoWarningsMarker(source)).toBe(false);
  });

  it("should return false for line comment marker", () => {
    // Only block comments should count
    const source = "// test-no-warnings\nvoid main() {}";
    expect(TestUtils.hasNoWarningsMarker(source)).toBe(false);
  });
});

describe("TestUtils.requiresCpp14", () => {
  it("should be a function", () => {
    expect(typeof TestUtils.requiresCpp14).toBe("function");
  });

  // Note: Full testing requires file system access, which is covered by integration tests
});

describe("requiresArmRuntime", () => {
  it("should return true for code with cmsis_gcc.h include", () => {
    const cCode = '#include "cmsis_gcc.h"\nvoid main() {}';
    expect(TestUtils.requiresArmRuntime(cCode)).toBe(true);
  });

  it("should return true for code with __LDREX", () => {
    const cCode = "void main() { __LDREX(&x); }";
    expect(TestUtils.requiresArmRuntime(cCode)).toBe(true);
  });

  it("should return true for code with __STREX", () => {
    const cCode = "void main() { __STREX(1, &x); }";
    expect(TestUtils.requiresArmRuntime(cCode)).toBe(true);
  });

  it("should return true for code with __get_PRIMASK", () => {
    const cCode = "void main() { __get_PRIMASK(); }";
    expect(TestUtils.requiresArmRuntime(cCode)).toBe(true);
  });

  it("should return true for code with __set_PRIMASK", () => {
    const cCode = "void main() { __set_PRIMASK(0); }";
    expect(TestUtils.requiresArmRuntime(cCode)).toBe(true);
  });

  it("should return true for code with __disable_irq", () => {
    const cCode = "void main() { __disable_irq(); }";
    expect(TestUtils.requiresArmRuntime(cCode)).toBe(true);
  });

  it("should return true for code with __enable_irq", () => {
    const cCode = "void main() { __enable_irq(); }";
    expect(TestUtils.requiresArmRuntime(cCode)).toBe(true);
  });

  it("should return false for regular C code", () => {
    const cCode = "int main() { return 0; }";
    expect(TestUtils.requiresArmRuntime(cCode)).toBe(false);
  });
});

describe("getExecutablePath", () => {
  it("should return a path in the temp directory", () => {
    const result = TestUtils.getExecutablePath("/path/to/test.test.cnx");
    expect(result).toContain("cnx-test-");
    expect(result).toContain("test");
  });

  it("should generate unique paths for the same input", () => {
    const path1 = TestUtils.getExecutablePath("/path/to/test.test.cnx");
    const path2 = TestUtils.getExecutablePath("/path/to/test.test.cnx");
    expect(path1).not.toBe(path2);
  });
});
