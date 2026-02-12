/**
 * Unit tests for StringDeclHelper
 *
 * Issue #644: Tests for the extracted string declaration helper.
 * Migrated to use CodeGenState instead of constructor DI.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import StringDeclHelper from "../StringDeclHelper.js";
import CodeGenState from "../../../../state/CodeGenState.js";

/**
 * Default callbacks for testing.
 */
const defaultCallbacks = {
  generateExpression: vi.fn((ctx: { getText: () => string }) => ctx.getText()),
  generateArrayDimensions: vi.fn(
    (dims: { expression: () => { getText: () => string } | null }[]) =>
      dims
        .map((d) => {
          const expr = d.expression();
          return expr ? `[${expr.getText()}]` : "[]";
        })
        .join(""),
  ),
  getStringConcatOperands: vi.fn(() => null),
  getSubstringOperands: vi.fn(() => null),
  getStringExprCapacity: vi.fn(() => null),
  requireStringInclude: vi.fn(),
};

describe("StringDeclHelper", () => {
  beforeEach(() => {
    CodeGenState.reset();
    CodeGenState.inFunctionBody = true;
    CodeGenState.indentLevel = 1;
    vi.clearAllMocks();
  });

  describe("generateStringDecl", () => {
    it("returns handled: false for non-string types", () => {
      const typeCtx = {
        stringType: () => null,
      } as never;

      const result = StringDeclHelper.generateStringDecl(
        typeCtx,
        "myVar",
        null,
        [],
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
        defaultCallbacks,
      );

      expect(result.handled).toBe(false);
    });

    it("generates bounded string with literal initializer", () => {
      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "64" }),
        }),
      } as never;

      const expression = {
        getText: () => '"Hello"',
      } as never;

      const result = StringDeclHelper.generateStringDecl(
        typeCtx,
        "greeting",
        expression,
        [],
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
        defaultCallbacks,
      );

      expect(result.handled).toBe(true);
      expect(result.code).toContain("char greeting[65]");
      expect(result.code).toContain('"Hello"');
    });

    it("generates empty bounded string without initializer", () => {
      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "32" }),
        }),
      } as never;

      const result = StringDeclHelper.generateStringDecl(
        typeCtx,
        "buffer",
        null,
        [],
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
        defaultCallbacks,
      );

      expect(result.handled).toBe(true);
      expect(result.code).toBe('char buffer[33] = "";');
    });

    it("generates const bounded string", () => {
      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "10" }),
        }),
      } as never;

      const expression = {
        getText: () => '"Test"',
      } as never;

      const result = StringDeclHelper.generateStringDecl(
        typeCtx,
        "label",
        expression,
        [],
        { extern: "", const: "const ", atomic: "", volatile: "" },
        true,
        defaultCallbacks,
      );

      expect(result.handled).toBe(true);
      expect(result.code).toContain("const char label[11]");
    });

    it("throws error for string literal exceeding capacity", () => {
      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "5" }),
        }),
      } as never;

      const expression = {
        getText: () => '"HelloWorld"', // 10 chars, exceeds 5
      } as never;

      expect(() =>
        StringDeclHelper.generateStringDecl(
          typeCtx,
          "small",
          expression,
          [],
          { extern: "", const: "", atomic: "", volatile: "" },
          false,
          defaultCallbacks,
        ),
      ).toThrow("exceeds string<5> capacity");
    });

    it("throws error for non-const unsized string", () => {
      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => null,
        }),
      } as never;

      expect(() =>
        StringDeclHelper.generateStringDecl(
          typeCtx,
          "invalid",
          null,
          [],
          { extern: "", const: "", atomic: "", volatile: "" },
          false,
          defaultCallbacks,
        ),
      ).toThrow("Non-const string requires explicit capacity");
    });

    it("throws error for unsized const string without initializer", () => {
      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => null,
        }),
      } as never;

      expect(() =>
        StringDeclHelper.generateStringDecl(
          typeCtx,
          "invalid",
          null,
          [],
          { extern: "", const: "const ", atomic: "", volatile: "" },
          true,
          defaultCallbacks,
        ),
      ).toThrow("const string requires initializer");
    });

    it("throws error for unsized const string with non-literal", () => {
      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => null,
        }),
      } as never;

      const expression = {
        getText: () => "otherVar",
      } as never;

      expect(() =>
        StringDeclHelper.generateStringDecl(
          typeCtx,
          "invalid",
          expression,
          [],
          { extern: "", const: "const ", atomic: "", volatile: "" },
          true,
          defaultCallbacks,
        ),
      ).toThrow("const string requires string literal");
    });

    it("generates unsized const string with literal initializer", () => {
      const requireStringInclude = vi.fn();
      const callbacks = {
        ...defaultCallbacks,
        requireStringInclude,
      };

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => null,
        }),
      } as never;

      const expression = {
        getText: () => '"Hello"',
      } as never;

      const result = StringDeclHelper.generateStringDecl(
        typeCtx,
        "greeting",
        expression,
        [],
        { extern: "", const: "const ", atomic: "", volatile: "" },
        true,
        callbacks,
      );

      expect(result.handled).toBe(true);
      expect(result.code).toBe('const char greeting[6] = "Hello";');
      expect(requireStringInclude).toHaveBeenCalled();
      expect(CodeGenState.getVariableTypeInfo("greeting")).toMatchObject({
        baseType: "char",
        isString: true,
        stringCapacity: 5,
      });
    });

    it("generates extern bounded string", () => {
      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "20" }),
        }),
      } as never;

      const expression = {
        getText: () => '"External"',
      } as never;

      const result = StringDeclHelper.generateStringDecl(
        typeCtx,
        "extStr",
        expression,
        [],
        { extern: "extern ", const: "", atomic: "", volatile: "" },
        false,
        defaultCallbacks,
      );

      expect(result.handled).toBe(true);
      expect(result.code).toContain("extern char extStr[21]");
    });
  });

  describe("string variable assignment validation", () => {
    it("throws error when source string capacity exceeds destination", () => {
      const callbacks = {
        ...defaultCallbacks,
        getStringExprCapacity: vi.fn(() => 100),
      };

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "32" }),
        }),
      } as never;

      const expression = {
        getText: () => "largeString", // Not a literal, so capacity check will run
      } as never;

      expect(() =>
        StringDeclHelper.generateStringDecl(
          typeCtx,
          "small",
          expression,
          [],
          { extern: "", const: "", atomic: "", volatile: "" },
          false,
          callbacks,
        ),
      ).toThrow("Cannot assign string<100> to string<32>");
    });

    it("allows assignment when source capacity fits", () => {
      const callbacks = {
        ...defaultCallbacks,
        getStringExprCapacity: vi.fn(() => 20),
      };

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "32" }),
        }),
      } as never;

      const expression = {
        getText: () => "smallString",
      } as never;

      const result = StringDeclHelper.generateStringDecl(
        typeCtx,
        "dest",
        expression,
        [],
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
        callbacks,
      );

      expect(result.handled).toBe(true);
      expect(result.code).toContain("char dest[33] = smallString;");
    });
  });

  describe("string concatenation", () => {
    it("generates concatenation code in function body", () => {
      const concatOps = {
        left: "str1",
        right: "str2",
        leftCapacity: 10,
        rightCapacity: 10,
      };
      const callbacks = {
        ...defaultCallbacks,
        getStringConcatOperands: vi.fn(() => concatOps),
      };

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "32" }),
        }),
      } as never;

      const expression = {
        getText: () => "str1 + str2",
      } as never;

      const result = StringDeclHelper.generateStringDecl(
        typeCtx,
        "combined",
        expression,
        [],
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
        callbacks,
      );

      expect(result.handled).toBe(true);
      expect(result.code).toContain('char combined[33] = "";');
      expect(result.code).toContain("strncpy(combined, str1, 32)");
      expect(result.code).toContain(
        "strncat(combined, str2, 32 - strlen(combined))",
      );
      expect(result.code).toContain("combined[32] = '\\0';");
    });

    it("throws error for concatenation at global scope", () => {
      CodeGenState.inFunctionBody = false;
      const concatOps = {
        left: "str1",
        right: "str2",
        leftCapacity: 10,
        rightCapacity: 10,
      };
      const callbacks = {
        ...defaultCallbacks,
        getStringConcatOperands: vi.fn(() => concatOps),
      };

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "32" }),
        }),
      } as never;

      const expression = {
        getText: () => "str1 + str2",
      } as never;

      expect(() =>
        StringDeclHelper.generateStringDecl(
          typeCtx,
          "combined",
          expression,
          [],
          { extern: "", const: "", atomic: "", volatile: "" },
          false,
          callbacks,
        ),
      ).toThrow("String concatenation cannot be used at global scope");
    });

    it("throws error when combined capacity exceeds destination", () => {
      const concatOps = {
        left: "str1",
        right: "str2",
        leftCapacity: 20,
        rightCapacity: 20,
      };
      const callbacks = {
        ...defaultCallbacks,
        getStringConcatOperands: vi.fn(() => concatOps),
      };

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "30" }),
        }),
      } as never;

      const expression = {
        getText: () => "str1 + str2",
      } as never;

      expect(() =>
        StringDeclHelper.generateStringDecl(
          typeCtx,
          "combined",
          expression,
          [],
          { extern: "", const: "", atomic: "", volatile: "" },
          false,
          callbacks,
        ),
      ).toThrow("String concatenation requires capacity 40, but string<30>");
    });

    it("generates const concatenation declaration", () => {
      const concatOps = {
        left: "str1",
        right: "str2",
        leftCapacity: 5,
        rightCapacity: 5,
      };
      const callbacks = {
        ...defaultCallbacks,
        getStringConcatOperands: vi.fn(() => concatOps),
      };

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "20" }),
        }),
      } as never;

      const expression = {
        getText: () => "str1 + str2",
      } as never;

      const result = StringDeclHelper.generateStringDecl(
        typeCtx,
        "combined",
        expression,
        [],
        { extern: "", const: "const ", atomic: "", volatile: "" },
        true,
        callbacks,
      );

      expect(result.code).toContain('const char combined[21] = "";');
    });
  });

  describe("substring extraction", () => {
    it("generates substring extraction code in function body", () => {
      const substringOps = {
        source: "srcStr",
        start: "0",
        length: "5",
        sourceCapacity: 32,
      };
      const callbacks = {
        ...defaultCallbacks,
        getSubstringOperands: vi.fn(() => substringOps),
      };

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "10" }),
        }),
      } as never;

      const expression = {
        getText: () => "srcStr.substring(0, 5)",
      } as never;

      const result = StringDeclHelper.generateStringDecl(
        typeCtx,
        "sub",
        expression,
        [],
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
        callbacks,
      );

      expect(result.handled).toBe(true);
      expect(result.code).toContain('char sub[11] = "";');
      expect(result.code).toContain("strncpy(sub, srcStr + 0, 5)");
      expect(result.code).toContain("sub[5] = '\\0';");
    });

    it("throws error for substring at global scope", () => {
      CodeGenState.inFunctionBody = false;
      const substringOps = {
        source: "srcStr",
        start: "0",
        length: "5",
        sourceCapacity: 32,
      };
      const callbacks = {
        ...defaultCallbacks,
        getSubstringOperands: vi.fn(() => substringOps),
      };

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "10" }),
        }),
      } as never;

      const expression = {
        getText: () => "srcStr.substring(0, 5)",
      } as never;

      expect(() =>
        StringDeclHelper.generateStringDecl(
          typeCtx,
          "sub",
          expression,
          [],
          { extern: "", const: "", atomic: "", volatile: "" },
          false,
          callbacks,
        ),
      ).toThrow("Substring extraction cannot be used at global scope");
    });

    it("throws error when substring bounds exceed source capacity", () => {
      const substringOps = {
        source: "srcStr",
        start: "30",
        length: "10",
        sourceCapacity: 32, // start + length = 40 > 32
      };
      const callbacks = {
        ...defaultCallbacks,
        getSubstringOperands: vi.fn(() => substringOps),
      };

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "20" }),
        }),
      } as never;

      const expression = {
        getText: () => "srcStr.substring(30, 10)",
      } as never;

      expect(() =>
        StringDeclHelper.generateStringDecl(
          typeCtx,
          "sub",
          expression,
          [],
          { extern: "", const: "", atomic: "", volatile: "" },
          false,
          callbacks,
        ),
      ).toThrow("Substring bounds [30, 10] exceed source string<32>");
    });

    it("throws error when substring length exceeds destination capacity", () => {
      const substringOps = {
        source: "srcStr",
        start: "0",
        length: "20",
        sourceCapacity: 32,
      };
      const callbacks = {
        ...defaultCallbacks,
        getSubstringOperands: vi.fn(() => substringOps),
      };

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "10" }),
        }),
      } as never;

      const expression = {
        getText: () => "srcStr.substring(0, 20)",
      } as never;

      expect(() =>
        StringDeclHelper.generateStringDecl(
          typeCtx,
          "sub",
          expression,
          [],
          { extern: "", const: "", atomic: "", volatile: "" },
          false,
          callbacks,
        ),
      ).toThrow("Substring length 20 exceeds destination string<10>");
    });

    it("skips bounds check when start is not numeric", () => {
      const substringOps = {
        source: "srcStr",
        start: "startVar", // Non-numeric
        length: "5",
        sourceCapacity: 32,
      };
      const callbacks = {
        ...defaultCallbacks,
        getSubstringOperands: vi.fn(() => substringOps),
      };

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "10" }),
        }),
      } as never;

      const expression = {
        getText: () => "srcStr.substring(startVar, 5)",
      } as never;

      const result = StringDeclHelper.generateStringDecl(
        typeCtx,
        "sub",
        expression,
        [],
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
        callbacks,
      );

      expect(result.handled).toBe(true);
      expect(result.code).toContain("strncpy(sub, srcStr + startVar, 5)");
    });

    it("skips length check when length is not numeric", () => {
      const substringOps = {
        source: "srcStr",
        start: "0",
        length: "lenVar", // Non-numeric
        sourceCapacity: 32,
      };
      const callbacks = {
        ...defaultCallbacks,
        getSubstringOperands: vi.fn(() => substringOps),
      };

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "10" }),
        }),
      } as never;

      const expression = {
        getText: () => "srcStr.substring(0, lenVar)",
      } as never;

      const result = StringDeclHelper.generateStringDecl(
        typeCtx,
        "sub",
        expression,
        [],
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
        callbacks,
      );

      expect(result.handled).toBe(true);
      expect(result.code).toContain("strncpy(sub, srcStr + 0, lenVar)");
    });

    it("generates const substring declaration", () => {
      const substringOps = {
        source: "srcStr",
        start: "5",
        length: "3",
        sourceCapacity: 32,
      };
      const callbacks = {
        ...defaultCallbacks,
        getSubstringOperands: vi.fn(() => substringOps),
      };

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "10" }),
        }),
      } as never;

      const expression = {
        getText: () => "srcStr.substring(5, 3)",
      } as never;

      const result = StringDeclHelper.generateStringDecl(
        typeCtx,
        "sub",
        expression,
        [],
        { extern: "", const: "const ", atomic: "", volatile: "" },
        true,
        callbacks,
      );

      expect(result.code).toContain('const char sub[11] = "";');
    });
  });

  describe("string array declarations", () => {
    it("generates string array with explicit initializer list", () => {
      const callbacks = {
        ...defaultCallbacks,
        generateExpression: vi.fn(() => {
          CodeGenState.lastArrayInitCount = 3;
          CodeGenState.lastArrayFillValue = undefined;
          return '{"Hello", "World", "Test"}';
        }),
        generateArrayDimensions: vi.fn(() => "[3]"),
      };

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "10" }),
        }),
      } as never;

      const expression = {
        getText: () => '["Hello", "World", "Test"]',
      } as never;

      const arrayDims = [
        { expression: () => ({ getText: () => "3" }) },
      ] as never[];

      const result = StringDeclHelper.generateStringDecl(
        typeCtx,
        "labels",
        expression,
        arrayDims,
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
        callbacks,
      );

      expect(result.handled).toBe(true);
      expect(result.code).toContain("[3]");
      expect(result.code).toContain("[11]"); // capacity + 1
    });

    it("generates string array with size inference", () => {
      const callbacks = {
        ...defaultCallbacks,
        generateExpression: vi.fn(() => {
          CodeGenState.lastArrayInitCount = 2;
          CodeGenState.lastArrayFillValue = undefined;
          return '{"One", "Two"}';
        }),
        generateArrayDimensions: vi.fn(() => "[]"),
      };

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "10" }),
        }),
      } as never;

      const expression = {
        getText: () => '["One", "Two"]',
      } as never;

      const arrayDims = [
        { expression: () => null }, // Empty dimension for inference
      ] as never[];

      const result = StringDeclHelper.generateStringDecl(
        typeCtx,
        "labels",
        expression,
        arrayDims,
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
        callbacks,
      );

      expect(result.handled).toBe(true);
      expect(result.code).toContain("[2]"); // Inferred size
      expect(result.code).toContain("[11]"); // capacity + 1
      expect(
        CodeGenState.getVariableTypeInfo("labels")?.arrayDimensions,
      ).toEqual([2, 11]);
    });

    it("generates string array without initializer (zero-init)", () => {
      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "20" }),
        }),
      } as never;

      const arrayDims = [
        { expression: () => ({ getText: () => "5" }) },
      ] as never[];

      const result = StringDeclHelper.generateStringDecl(
        typeCtx,
        "messages",
        null,
        arrayDims,
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
        defaultCallbacks,
      );

      expect(result.handled).toBe(true);
      expect(result.code).toBe("char messages[5][21] = {0};");
    });

    it("generates string array with fill-all syntax", () => {
      const callbacks = {
        ...defaultCallbacks,
        generateExpression: vi.fn(() => {
          CodeGenState.lastArrayInitCount = 0;
          CodeGenState.lastArrayFillValue = '"Hello"';
          return '{"Hello"*}';
        }),
        generateArrayDimensions: vi.fn(() => "[3]"),
      };

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "10" }),
        }),
      } as never;

      const expression = {
        getText: () => '["Hello"*]',
      } as never;

      const arrayDims = [
        { expression: () => ({ getText: () => "3" }) },
      ] as never[];

      const result = StringDeclHelper.generateStringDecl(
        typeCtx,
        "greetings",
        expression,
        arrayDims,
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
        callbacks,
      );

      expect(result.handled).toBe(true);
      expect(result.code).toContain('{"Hello", "Hello", "Hello"}');
    });

    it("generates string array with empty fill value (no expansion)", () => {
      const callbacks = {
        ...defaultCallbacks,
        generateExpression: vi.fn(() => {
          CodeGenState.lastArrayInitCount = 0;
          CodeGenState.lastArrayFillValue = '""';
          return '{""*}';
        }),
        generateArrayDimensions: vi.fn(() => "[3]"),
      };

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "10" }),
        }),
      } as never;

      const expression = {
        getText: () => '[""*]',
      } as never;

      const arrayDims = [
        { expression: () => ({ getText: () => "3" }) },
      ] as never[];

      const result = StringDeclHelper.generateStringDecl(
        typeCtx,
        "empty",
        expression,
        arrayDims,
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
        callbacks,
      );

      expect(result.handled).toBe(true);
      // Empty string fill should not be expanded
      expect(result.code).not.toContain('"", "", ""');
    });

    it("throws error for fill-all without explicit size", () => {
      const callbacks = {
        ...defaultCallbacks,
        generateExpression: vi.fn(() => {
          CodeGenState.lastArrayInitCount = 0;
          CodeGenState.lastArrayFillValue = '"Hello"';
          return '{"Hello"*}';
        }),
        generateArrayDimensions: vi.fn(() => "[]"),
      };

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "10" }),
        }),
      } as never;

      const expression = {
        getText: () => '["Hello"*]',
      } as never;

      const arrayDims = [
        { expression: () => null }, // Empty - no size
      ] as never[];

      expect(() =>
        StringDeclHelper.generateStringDecl(
          typeCtx,
          "greetings",
          expression,
          arrayDims,
          { extern: "", const: "", atomic: "", volatile: "" },
          false,
          callbacks,
        ),
      ).toThrow("Fill-all syntax");
    });

    it("throws error for array size mismatch", () => {
      const callbacks = {
        ...defaultCallbacks,
        generateExpression: vi.fn(() => {
          CodeGenState.lastArrayInitCount = 2; // Only 2 elements
          CodeGenState.lastArrayFillValue = undefined;
          return '{"One", "Two"}';
        }),
        generateArrayDimensions: vi.fn(() => "[3]"),
      };

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "10" }),
        }),
      } as never;

      const expression = {
        getText: () => '["One", "Two"]',
      } as never;

      const arrayDims = [
        { expression: () => ({ getText: () => "3" }) }, // Declared size = 3
      ] as never[];

      expect(() =>
        StringDeclHelper.generateStringDecl(
          typeCtx,
          "labels",
          expression,
          arrayDims,
          { extern: "", const: "", atomic: "", volatile: "" },
          false,
          callbacks,
        ),
      ).toThrow("Array size mismatch - declared [3] but got 2 elements");
    });

    it("throws error for string array initialization from variable", () => {
      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "10" }),
        }),
      } as never;

      const expression = {
        getText: () => "otherArray", // Variable, not array literal
      } as never;

      const arrayDims = [
        { expression: () => ({ getText: () => "3" }) },
      ] as never[];

      expect(() =>
        StringDeclHelper.generateStringDecl(
          typeCtx,
          "labels",
          expression,
          arrayDims,
          { extern: "", const: "", atomic: "", volatile: "" },
          false,
          defaultCallbacks,
        ),
      ).toThrow("String array initialization from variables not supported");
    });

    it("generates string array with modifiers", () => {
      const callbacks = {
        ...defaultCallbacks,
        generateExpression: vi.fn(() => {
          CodeGenState.lastArrayInitCount = 2;
          CodeGenState.lastArrayFillValue = undefined;
          return '{"A", "B"}';
        }),
        generateArrayDimensions: vi.fn(() => "[2]"),
      };

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "5" }),
        }),
      } as never;

      const expression = {
        getText: () => '["A", "B"]',
      } as never;

      const arrayDims = [
        { expression: () => ({ getText: () => "2" }) },
      ] as never[];

      const result = StringDeclHelper.generateStringDecl(
        typeCtx,
        "data",
        expression,
        arrayDims,
        {
          extern: "extern ",
          const: "const ",
          atomic: "",
          volatile: "volatile ",
        },
        true,
        callbacks,
      );

      expect(result.code).toContain("extern const volatile char data");
    });

    it("handles non-numeric array dimension (macro)", () => {
      const callbacks = {
        ...defaultCallbacks,
        generateExpression: vi.fn(() => {
          CodeGenState.lastArrayInitCount = 2;
          CodeGenState.lastArrayFillValue = undefined;
          return '{"A", "B"}';
        }),
        generateArrayDimensions: vi.fn(() => "[ARRAY_SIZE]"),
      };

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "10" }),
        }),
      } as never;

      const expression = {
        getText: () => '["A", "B"]',
      } as never;

      const arrayDims = [
        { expression: () => ({ getText: () => "ARRAY_SIZE" }) }, // Macro, not number
      ] as never[];

      // Should not throw - macros skip size validation
      const result = StringDeclHelper.generateStringDecl(
        typeCtx,
        "data",
        expression,
        arrayDims,
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
        callbacks,
      );

      expect(result.handled).toBe(true);
    });

    it("tracks local arrays in localArrays set", () => {
      const callbacks = {
        ...defaultCallbacks,
        generateExpression: vi.fn(() => {
          CodeGenState.lastArrayInitCount = 2;
          CodeGenState.lastArrayFillValue = undefined;
          return '{"X", "Y"}';
        }),
        generateArrayDimensions: vi.fn(() => "[2]"),
      };

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "5" }),
        }),
      } as never;

      const expression = {
        getText: () => '["X", "Y"]',
      } as never;

      const arrayDims = [
        { expression: () => ({ getText: () => "2" }) },
      ] as never[];

      StringDeclHelper.generateStringDecl(
        typeCtx,
        "tracked",
        expression,
        arrayDims,
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
        callbacks,
      );

      expect(CodeGenState.localArrays.has("tracked")).toBe(true);
    });
  });
});
