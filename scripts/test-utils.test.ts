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

  // Note: File-based testing covered by integration tests
});

describe("TestUtils.hasCppFeatures", () => {
  // Issue #267: C++ casts
  describe("C++ casts", () => {
    it("should detect static_cast", () => {
      expect(TestUtils.hasCppFeatures("static_cast<int>(x)")).toBe(true);
    });

    it("should detect reinterpret_cast", () => {
      expect(TestUtils.hasCppFeatures("reinterpret_cast<char*>(p)")).toBe(true);
    });

    it("should detect const_cast", () => {
      expect(TestUtils.hasCppFeatures("const_cast<int*>(p)")).toBe(true);
    });

    it("should detect dynamic_cast", () => {
      expect(TestUtils.hasCppFeatures("dynamic_cast<Derived*>(base)")).toBe(
        true,
      );
    });
  });

  // Issue #291: C++ template types
  describe("C++ template types", () => {
    it("should detect template types", () => {
      expect(TestUtils.hasCppFeatures("vector<int> v;")).toBe(true);
    });

    it("should detect nested templates", () => {
      expect(TestUtils.hasCppFeatures("map<string, int> m;")).toBe(true);
    });

    it("should NOT detect string<N> (C-Next bounded string)", () => {
      expect(TestUtils.hasCppFeatures("string<64> name;")).toBe(false);
    });

    it("should NOT detect comparison operators", () => {
      expect(TestUtils.hasCppFeatures("if (x < y) { }")).toBe(false);
    });
  });

  // Issue #322: Scope resolution operator
  describe("scope resolution operator", () => {
    it("should detect namespace access", () => {
      expect(TestUtils.hasCppFeatures("std::cout << x;")).toBe(true);
    });

    it("should detect static method calls", () => {
      expect(TestUtils.hasCppFeatures("MyClass::staticMethod();")).toBe(true);
    });
  });

  // Issue #375: C++ constructor syntax
  describe("C++ constructor syntax", () => {
    it("should detect single-arg constructor", () => {
      expect(
        TestUtils.hasCppFeatures("Adafruit_MAX31856 thermocouple(pin);"),
      ).toBe(true);
    });

    it("should detect multi-arg constructor", () => {
      expect(TestUtils.hasCppFeatures("MyClass obj(arg1, arg2, arg3);")).toBe(
        true,
      );
    });

    it("should detect constructor at start of line with indent", () => {
      expect(TestUtils.hasCppFeatures("    SomeClass instance(value);")).toBe(
        true,
      );
    });

    // Regression tests - these should NOT be detected as constructors
    it("should NOT detect return statements as constructors", () => {
      expect(TestUtils.hasCppFeatures("return strlen(s);")).toBe(false);
    });

    it("should NOT detect return with function call", () => {
      expect(TestUtils.hasCppFeatures("    return getValue(x);")).toBe(false);
    });

    it("should NOT detect if statements", () => {
      expect(TestUtils.hasCppFeatures("if (condition) { }")).toBe(false);
    });

    it("should NOT detect while loops", () => {
      expect(TestUtils.hasCppFeatures("while (running) { }")).toBe(false);
    });

    it("should NOT detect for loops", () => {
      expect(TestUtils.hasCppFeatures("for (i) { }")).toBe(false);
    });

    it("should NOT detect switch statements", () => {
      expect(TestUtils.hasCppFeatures("switch (x) { }")).toBe(false);
    });

    it("should NOT detect sizeof expressions", () => {
      expect(TestUtils.hasCppFeatures("sizeof (int);")).toBe(false);
    });

    it("should NOT detect standalone function calls", () => {
      // Function calls don't have a type before them
      expect(TestUtils.hasCppFeatures("printf(msg);")).toBe(false);
    });
  });

  // Plain C code should not trigger C++ detection
  describe("plain C code", () => {
    it("should NOT detect plain C functions", () => {
      expect(TestUtils.hasCppFeatures("int main(void) { return 0; }")).toBe(
        false,
      );
    });

    it("should NOT detect C variable declarations", () => {
      expect(TestUtils.hasCppFeatures("int x = 5;")).toBe(false);
    });

    it("should NOT detect C array declarations", () => {
      expect(TestUtils.hasCppFeatures("char buffer[64];")).toBe(false);
    });
  });
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
