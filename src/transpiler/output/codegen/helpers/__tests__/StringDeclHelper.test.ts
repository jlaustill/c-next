/**
 * Unit tests for StringDeclHelper
 *
 * Issue #644: Tests for the extracted string declaration helper.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import StringDeclHelper from "../StringDeclHelper.js";
import type TTypeInfo from "../../types/TTypeInfo.js";

describe("StringDeclHelper", () => {
  let typeRegistry: Map<string, TTypeInfo>;
  let localArrays: Set<string>;
  let arrayInitState: {
    lastArrayInitCount: number;
    lastArrayFillValue: string | undefined;
  };
  let helper: StringDeclHelper;

  beforeEach(() => {
    typeRegistry = new Map();
    localArrays = new Set();
    arrayInitState = {
      lastArrayInitCount: 0,
      lastArrayFillValue: undefined,
    };

    helper = new StringDeclHelper({
      typeRegistry,
      getInFunctionBody: () => true,
      getIndentLevel: () => 1,
      arrayInitState,
      localArrays,
      generateExpression: vi.fn((ctx) => ctx.getText()),
      generateArrayDimensions: vi.fn((dims) =>
        dims
          .map((d: { expression: () => { getText: () => string } | null }) => {
            const expr = d.expression();
            return expr ? `[${expr.getText()}]` : "[]";
          })
          .join(""),
      ),
      getStringConcatOperands: vi.fn(() => null),
      getSubstringOperands: vi.fn(() => null),
      getStringLiteralLength: vi.fn((literal) => literal.length - 2), // Remove quotes
      getStringExprCapacity: vi.fn(() => null),
      requireStringInclude: vi.fn(),
    });
  });

  describe("generateStringDecl", () => {
    it("returns handled: false for non-string types", () => {
      const typeCtx = {
        stringType: () => null,
      } as never;

      const result = helper.generateStringDecl(
        typeCtx,
        "myVar",
        null,
        [],
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
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

      const result = helper.generateStringDecl(
        typeCtx,
        "greeting",
        expression,
        [],
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
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

      const result = helper.generateStringDecl(
        typeCtx,
        "buffer",
        null,
        [],
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
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

      const result = helper.generateStringDecl(
        typeCtx,
        "label",
        expression,
        [],
        { extern: "", const: "const ", atomic: "", volatile: "" },
        true,
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
        helper.generateStringDecl(
          typeCtx,
          "small",
          expression,
          [],
          { extern: "", const: "", atomic: "", volatile: "" },
          false,
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
        helper.generateStringDecl(
          typeCtx,
          "invalid",
          null,
          [],
          { extern: "", const: "", atomic: "", volatile: "" },
          false,
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
        helper.generateStringDecl(
          typeCtx,
          "invalid",
          null,
          [],
          { extern: "", const: "const ", atomic: "", volatile: "" },
          true,
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
        helper.generateStringDecl(
          typeCtx,
          "invalid",
          expression,
          [],
          { extern: "", const: "const ", atomic: "", volatile: "" },
          true,
        ),
      ).toThrow("const string requires string literal");
    });

    it("generates unsized const string with literal initializer", () => {
      const requireStringInclude = vi.fn();
      const helperWithMock = new StringDeclHelper({
        typeRegistry,
        getInFunctionBody: () => true,
        getIndentLevel: () => 1,
        arrayInitState,
        localArrays,
        generateExpression: vi.fn((ctx) => ctx.getText()),
        generateArrayDimensions: vi.fn(),
        getStringConcatOperands: vi.fn(() => null),
        getSubstringOperands: vi.fn(() => null),
        getStringLiteralLength: vi.fn((literal) => literal.length - 2),
        getStringExprCapacity: vi.fn(() => null),
        requireStringInclude,
      });

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => null,
        }),
      } as never;

      const expression = {
        getText: () => '"Hello"',
      } as never;

      const result = helperWithMock.generateStringDecl(
        typeCtx,
        "greeting",
        expression,
        [],
        { extern: "", const: "const ", atomic: "", volatile: "" },
        true,
      );

      expect(result.handled).toBe(true);
      expect(result.code).toBe('const char greeting[6] = "Hello";');
      expect(requireStringInclude).toHaveBeenCalled();
      expect(typeRegistry.get("greeting")).toMatchObject({
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

      const result = helper.generateStringDecl(
        typeCtx,
        "extStr",
        expression,
        [],
        { extern: "extern ", const: "", atomic: "", volatile: "" },
        false,
      );

      expect(result.handled).toBe(true);
      expect(result.code).toContain("extern char extStr[21]");
    });
  });

  describe("string variable assignment validation", () => {
    it("throws error when source string capacity exceeds destination", () => {
      const getStringExprCapacity = vi.fn(() => 100);
      const helperWithCapacity = new StringDeclHelper({
        typeRegistry,
        getInFunctionBody: () => true,
        getIndentLevel: () => 1,
        arrayInitState,
        localArrays,
        generateExpression: vi.fn((ctx) => ctx.getText()),
        generateArrayDimensions: vi.fn(),
        getStringConcatOperands: vi.fn(() => null),
        getSubstringOperands: vi.fn(() => null),
        getStringLiteralLength: vi.fn((literal) => literal.length - 2),
        getStringExprCapacity,
        requireStringInclude: vi.fn(),
      });

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "32" }),
        }),
      } as never;

      const expression = {
        getText: () => "largeString", // Not a literal, so capacity check will run
      } as never;

      expect(() =>
        helperWithCapacity.generateStringDecl(
          typeCtx,
          "small",
          expression,
          [],
          { extern: "", const: "", atomic: "", volatile: "" },
          false,
        ),
      ).toThrow("Cannot assign string<100> to string<32>");
    });

    it("allows assignment when source capacity fits", () => {
      const getStringExprCapacity = vi.fn(() => 20);
      const helperWithCapacity = new StringDeclHelper({
        typeRegistry,
        getInFunctionBody: () => true,
        getIndentLevel: () => 1,
        arrayInitState,
        localArrays,
        generateExpression: vi.fn((ctx) => ctx.getText()),
        generateArrayDimensions: vi.fn(),
        getStringConcatOperands: vi.fn(() => null),
        getSubstringOperands: vi.fn(() => null),
        getStringLiteralLength: vi.fn((literal) => literal.length - 2),
        getStringExprCapacity,
        requireStringInclude: vi.fn(),
      });

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "32" }),
        }),
      } as never;

      const expression = {
        getText: () => "smallString",
      } as never;

      const result = helperWithCapacity.generateStringDecl(
        typeCtx,
        "dest",
        expression,
        [],
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
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
      const getStringConcatOperands = vi.fn(() => concatOps);

      const helperWithConcat = new StringDeclHelper({
        typeRegistry,
        getInFunctionBody: () => true,
        getIndentLevel: () => 1,
        arrayInitState,
        localArrays,
        generateExpression: vi.fn((ctx) => ctx.getText()),
        generateArrayDimensions: vi.fn(),
        getStringConcatOperands,
        getSubstringOperands: vi.fn(() => null),
        getStringLiteralLength: vi.fn((literal) => literal.length - 2),
        getStringExprCapacity: vi.fn(() => null),
        requireStringInclude: vi.fn(),
      });

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "32" }),
        }),
      } as never;

      const expression = {
        getText: () => "str1 + str2",
      } as never;

      const result = helperWithConcat.generateStringDecl(
        typeCtx,
        "combined",
        expression,
        [],
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
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
      const concatOps = {
        left: "str1",
        right: "str2",
        leftCapacity: 10,
        rightCapacity: 10,
      };

      const helperGlobalScope = new StringDeclHelper({
        typeRegistry,
        getInFunctionBody: () => false, // Global scope
        getIndentLevel: () => 0,
        arrayInitState,
        localArrays,
        generateExpression: vi.fn((ctx) => ctx.getText()),
        generateArrayDimensions: vi.fn(),
        getStringConcatOperands: vi.fn(() => concatOps),
        getSubstringOperands: vi.fn(() => null),
        getStringLiteralLength: vi.fn((literal) => literal.length - 2),
        getStringExprCapacity: vi.fn(() => null),
        requireStringInclude: vi.fn(),
      });

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "32" }),
        }),
      } as never;

      const expression = {
        getText: () => "str1 + str2",
      } as never;

      expect(() =>
        helperGlobalScope.generateStringDecl(
          typeCtx,
          "combined",
          expression,
          [],
          { extern: "", const: "", atomic: "", volatile: "" },
          false,
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

      const helperWithConcat = new StringDeclHelper({
        typeRegistry,
        getInFunctionBody: () => true,
        getIndentLevel: () => 1,
        arrayInitState,
        localArrays,
        generateExpression: vi.fn((ctx) => ctx.getText()),
        generateArrayDimensions: vi.fn(),
        getStringConcatOperands: vi.fn(() => concatOps),
        getSubstringOperands: vi.fn(() => null),
        getStringLiteralLength: vi.fn((literal) => literal.length - 2),
        getStringExprCapacity: vi.fn(() => null),
        requireStringInclude: vi.fn(),
      });

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "30" }),
        }),
      } as never;

      const expression = {
        getText: () => "str1 + str2",
      } as never;

      expect(() =>
        helperWithConcat.generateStringDecl(
          typeCtx,
          "combined",
          expression,
          [],
          { extern: "", const: "", atomic: "", volatile: "" },
          false,
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

      const helperWithConcat = new StringDeclHelper({
        typeRegistry,
        getInFunctionBody: () => true,
        getIndentLevel: () => 1,
        arrayInitState,
        localArrays,
        generateExpression: vi.fn((ctx) => ctx.getText()),
        generateArrayDimensions: vi.fn(),
        getStringConcatOperands: vi.fn(() => concatOps),
        getSubstringOperands: vi.fn(() => null),
        getStringLiteralLength: vi.fn((literal) => literal.length - 2),
        getStringExprCapacity: vi.fn(() => null),
        requireStringInclude: vi.fn(),
      });

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "20" }),
        }),
      } as never;

      const expression = {
        getText: () => "str1 + str2",
      } as never;

      const result = helperWithConcat.generateStringDecl(
        typeCtx,
        "combined",
        expression,
        [],
        { extern: "", const: "const ", atomic: "", volatile: "" },
        true,
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

      const helperWithSubstr = new StringDeclHelper({
        typeRegistry,
        getInFunctionBody: () => true,
        getIndentLevel: () => 1,
        arrayInitState,
        localArrays,
        generateExpression: vi.fn((ctx) => ctx.getText()),
        generateArrayDimensions: vi.fn(),
        getStringConcatOperands: vi.fn(() => null),
        getSubstringOperands: vi.fn(() => substringOps),
        getStringLiteralLength: vi.fn((literal) => literal.length - 2),
        getStringExprCapacity: vi.fn(() => null),
        requireStringInclude: vi.fn(),
      });

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "10" }),
        }),
      } as never;

      const expression = {
        getText: () => "srcStr.substring(0, 5)",
      } as never;

      const result = helperWithSubstr.generateStringDecl(
        typeCtx,
        "sub",
        expression,
        [],
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
      );

      expect(result.handled).toBe(true);
      expect(result.code).toContain('char sub[11] = "";');
      expect(result.code).toContain("strncpy(sub, srcStr + 0, 5)");
      expect(result.code).toContain("sub[5] = '\\0';");
    });

    it("throws error for substring at global scope", () => {
      const substringOps = {
        source: "srcStr",
        start: "0",
        length: "5",
        sourceCapacity: 32,
      };

      const helperGlobalScope = new StringDeclHelper({
        typeRegistry,
        getInFunctionBody: () => false,
        getIndentLevel: () => 0,
        arrayInitState,
        localArrays,
        generateExpression: vi.fn((ctx) => ctx.getText()),
        generateArrayDimensions: vi.fn(),
        getStringConcatOperands: vi.fn(() => null),
        getSubstringOperands: vi.fn(() => substringOps),
        getStringLiteralLength: vi.fn((literal) => literal.length - 2),
        getStringExprCapacity: vi.fn(() => null),
        requireStringInclude: vi.fn(),
      });

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "10" }),
        }),
      } as never;

      const expression = {
        getText: () => "srcStr.substring(0, 5)",
      } as never;

      expect(() =>
        helperGlobalScope.generateStringDecl(
          typeCtx,
          "sub",
          expression,
          [],
          { extern: "", const: "", atomic: "", volatile: "" },
          false,
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

      const helperWithSubstr = new StringDeclHelper({
        typeRegistry,
        getInFunctionBody: () => true,
        getIndentLevel: () => 1,
        arrayInitState,
        localArrays,
        generateExpression: vi.fn((ctx) => ctx.getText()),
        generateArrayDimensions: vi.fn(),
        getStringConcatOperands: vi.fn(() => null),
        getSubstringOperands: vi.fn(() => substringOps),
        getStringLiteralLength: vi.fn((literal) => literal.length - 2),
        getStringExprCapacity: vi.fn(() => null),
        requireStringInclude: vi.fn(),
      });

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "20" }),
        }),
      } as never;

      const expression = {
        getText: () => "srcStr.substring(30, 10)",
      } as never;

      expect(() =>
        helperWithSubstr.generateStringDecl(
          typeCtx,
          "sub",
          expression,
          [],
          { extern: "", const: "", atomic: "", volatile: "" },
          false,
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

      const helperWithSubstr = new StringDeclHelper({
        typeRegistry,
        getInFunctionBody: () => true,
        getIndentLevel: () => 1,
        arrayInitState,
        localArrays,
        generateExpression: vi.fn((ctx) => ctx.getText()),
        generateArrayDimensions: vi.fn(),
        getStringConcatOperands: vi.fn(() => null),
        getSubstringOperands: vi.fn(() => substringOps),
        getStringLiteralLength: vi.fn((literal) => literal.length - 2),
        getStringExprCapacity: vi.fn(() => null),
        requireStringInclude: vi.fn(),
      });

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "10" }),
        }),
      } as never;

      const expression = {
        getText: () => "srcStr.substring(0, 20)",
      } as never;

      expect(() =>
        helperWithSubstr.generateStringDecl(
          typeCtx,
          "sub",
          expression,
          [],
          { extern: "", const: "", atomic: "", volatile: "" },
          false,
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

      const helperWithSubstr = new StringDeclHelper({
        typeRegistry,
        getInFunctionBody: () => true,
        getIndentLevel: () => 1,
        arrayInitState,
        localArrays,
        generateExpression: vi.fn((ctx) => ctx.getText()),
        generateArrayDimensions: vi.fn(),
        getStringConcatOperands: vi.fn(() => null),
        getSubstringOperands: vi.fn(() => substringOps),
        getStringLiteralLength: vi.fn((literal) => literal.length - 2),
        getStringExprCapacity: vi.fn(() => null),
        requireStringInclude: vi.fn(),
      });

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "10" }),
        }),
      } as never;

      const expression = {
        getText: () => "srcStr.substring(startVar, 5)",
      } as never;

      const result = helperWithSubstr.generateStringDecl(
        typeCtx,
        "sub",
        expression,
        [],
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
      );

      // Should succeed - no bounds check when start is not numeric
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

      const helperWithSubstr = new StringDeclHelper({
        typeRegistry,
        getInFunctionBody: () => true,
        getIndentLevel: () => 1,
        arrayInitState,
        localArrays,
        generateExpression: vi.fn((ctx) => ctx.getText()),
        generateArrayDimensions: vi.fn(),
        getStringConcatOperands: vi.fn(() => null),
        getSubstringOperands: vi.fn(() => substringOps),
        getStringLiteralLength: vi.fn((literal) => literal.length - 2),
        getStringExprCapacity: vi.fn(() => null),
        requireStringInclude: vi.fn(),
      });

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "10" }),
        }),
      } as never;

      const expression = {
        getText: () => "srcStr.substring(0, lenVar)",
      } as never;

      const result = helperWithSubstr.generateStringDecl(
        typeCtx,
        "sub",
        expression,
        [],
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
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

      const helperWithSubstr = new StringDeclHelper({
        typeRegistry,
        getInFunctionBody: () => true,
        getIndentLevel: () => 1,
        arrayInitState,
        localArrays,
        generateExpression: vi.fn((ctx) => ctx.getText()),
        generateArrayDimensions: vi.fn(),
        getStringConcatOperands: vi.fn(() => null),
        getSubstringOperands: vi.fn(() => substringOps),
        getStringLiteralLength: vi.fn((literal) => literal.length - 2),
        getStringExprCapacity: vi.fn(() => null),
        requireStringInclude: vi.fn(),
      });

      const typeCtx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({ getText: () => "10" }),
        }),
      } as never;

      const expression = {
        getText: () => "srcStr.substring(5, 3)",
      } as never;

      const result = helperWithSubstr.generateStringDecl(
        typeCtx,
        "sub",
        expression,
        [],
        { extern: "", const: "const ", atomic: "", volatile: "" },
        true,
      );

      expect(result.code).toContain('const char sub[11] = "";');
    });
  });

  describe("string array declarations", () => {
    it("generates string array with explicit initializer list", () => {
      // The arrayInitState is shared and mutated by generateExpression
      const sharedArrayInitState = {
        lastArrayInitCount: 0,
        lastArrayFillValue: undefined as string | undefined,
      };

      const helperWithArray = new StringDeclHelper({
        typeRegistry,
        getInFunctionBody: () => true,
        getIndentLevel: () => 1,
        arrayInitState: sharedArrayInitState,
        localArrays,
        // generateExpression sets array init state as a side effect
        generateExpression: vi.fn(() => {
          sharedArrayInitState.lastArrayInitCount = 3;
          sharedArrayInitState.lastArrayFillValue = undefined;
          return '{"Hello", "World", "Test"}';
        }),
        generateArrayDimensions: vi.fn(() => "[3]"),
        getStringConcatOperands: vi.fn(() => null),
        getSubstringOperands: vi.fn(() => null),
        getStringLiteralLength: vi.fn((literal) => literal.length - 2),
        getStringExprCapacity: vi.fn(() => null),
        requireStringInclude: vi.fn(),
      });

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

      const result = helperWithArray.generateStringDecl(
        typeCtx,
        "labels",
        expression,
        arrayDims,
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
      );

      expect(result.handled).toBe(true);
      expect(result.code).toContain("[3]");
      expect(result.code).toContain("[11]"); // capacity + 1
    });

    it("generates string array with size inference", () => {
      const sharedArrayInitState = {
        lastArrayInitCount: 0,
        lastArrayFillValue: undefined as string | undefined,
      };

      const helperWithArray = new StringDeclHelper({
        typeRegistry,
        getInFunctionBody: () => true,
        getIndentLevel: () => 1,
        arrayInitState: sharedArrayInitState,
        localArrays,
        generateExpression: vi.fn(() => {
          sharedArrayInitState.lastArrayInitCount = 2;
          sharedArrayInitState.lastArrayFillValue = undefined;
          return '{"One", "Two"}';
        }),
        generateArrayDimensions: vi.fn(() => "[]"),
        getStringConcatOperands: vi.fn(() => null),
        getSubstringOperands: vi.fn(() => null),
        getStringLiteralLength: vi.fn((literal) => literal.length - 2),
        getStringExprCapacity: vi.fn(() => null),
        requireStringInclude: vi.fn(),
      });

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

      const result = helperWithArray.generateStringDecl(
        typeCtx,
        "labels",
        expression,
        arrayDims,
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
      );

      expect(result.handled).toBe(true);
      expect(result.code).toContain("[2]"); // Inferred size
      expect(result.code).toContain("[11]"); // capacity + 1
      expect(typeRegistry.get("labels")?.arrayDimensions).toEqual([2, 11]);
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

      const result = helper.generateStringDecl(
        typeCtx,
        "messages",
        null,
        arrayDims,
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
      );

      expect(result.handled).toBe(true);
      expect(result.code).toBe("char messages[5][21] = {0};");
    });

    it("generates string array with fill-all syntax", () => {
      const sharedArrayInitState = {
        lastArrayInitCount: 0,
        lastArrayFillValue: undefined as string | undefined,
      };

      const helperWithFill = new StringDeclHelper({
        typeRegistry,
        getInFunctionBody: () => true,
        getIndentLevel: () => 1,
        arrayInitState: sharedArrayInitState,
        localArrays,
        generateExpression: vi.fn(() => {
          sharedArrayInitState.lastArrayInitCount = 0;
          sharedArrayInitState.lastArrayFillValue = '"Hello"';
          return '{"Hello"*}';
        }),
        generateArrayDimensions: vi.fn(() => "[3]"),
        getStringConcatOperands: vi.fn(() => null),
        getSubstringOperands: vi.fn(() => null),
        getStringLiteralLength: vi.fn((literal) => literal.length - 2),
        getStringExprCapacity: vi.fn(() => null),
        requireStringInclude: vi.fn(),
      });

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

      const result = helperWithFill.generateStringDecl(
        typeCtx,
        "greetings",
        expression,
        arrayDims,
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
      );

      expect(result.handled).toBe(true);
      expect(result.code).toContain('{"Hello", "Hello", "Hello"}');
    });

    it("generates string array with empty fill value (no expansion)", () => {
      const sharedArrayInitState = {
        lastArrayInitCount: 0,
        lastArrayFillValue: undefined as string | undefined,
      };

      const helperWithFill = new StringDeclHelper({
        typeRegistry,
        getInFunctionBody: () => true,
        getIndentLevel: () => 1,
        arrayInitState: sharedArrayInitState,
        localArrays,
        generateExpression: vi.fn(() => {
          sharedArrayInitState.lastArrayInitCount = 0;
          sharedArrayInitState.lastArrayFillValue = '""';
          return '{""*}';
        }),
        generateArrayDimensions: vi.fn(() => "[3]"),
        getStringConcatOperands: vi.fn(() => null),
        getSubstringOperands: vi.fn(() => null),
        getStringLiteralLength: vi.fn((literal) => literal.length - 2),
        getStringExprCapacity: vi.fn(() => null),
        requireStringInclude: vi.fn(),
      });

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

      const result = helperWithFill.generateStringDecl(
        typeCtx,
        "empty",
        expression,
        arrayDims,
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
      );

      expect(result.handled).toBe(true);
      // Empty string fill should not be expanded
      expect(result.code).not.toContain('"", "", ""');
    });

    it("throws error for fill-all without explicit size", () => {
      const sharedArrayInitState = {
        lastArrayInitCount: 0,
        lastArrayFillValue: undefined as string | undefined,
      };

      const helperWithFill = new StringDeclHelper({
        typeRegistry,
        getInFunctionBody: () => true,
        getIndentLevel: () => 1,
        arrayInitState: sharedArrayInitState,
        localArrays,
        generateExpression: vi.fn(() => {
          sharedArrayInitState.lastArrayInitCount = 0;
          sharedArrayInitState.lastArrayFillValue = '"Hello"';
          return '{"Hello"*}';
        }),
        generateArrayDimensions: vi.fn(() => "[]"),
        getStringConcatOperands: vi.fn(() => null),
        getSubstringOperands: vi.fn(() => null),
        getStringLiteralLength: vi.fn((literal) => literal.length - 2),
        getStringExprCapacity: vi.fn(() => null),
        requireStringInclude: vi.fn(),
      });

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
        helperWithFill.generateStringDecl(
          typeCtx,
          "greetings",
          expression,
          arrayDims,
          { extern: "", const: "", atomic: "", volatile: "" },
          false,
        ),
      ).toThrow("Fill-all syntax");
    });

    it("throws error for array size mismatch", () => {
      const sharedArrayInitState = {
        lastArrayInitCount: 0,
        lastArrayFillValue: undefined as string | undefined,
      };

      const helperWithArray = new StringDeclHelper({
        typeRegistry,
        getInFunctionBody: () => true,
        getIndentLevel: () => 1,
        arrayInitState: sharedArrayInitState,
        localArrays,
        generateExpression: vi.fn(() => {
          sharedArrayInitState.lastArrayInitCount = 2; // Only 2 elements
          sharedArrayInitState.lastArrayFillValue = undefined;
          return '{"One", "Two"}';
        }),
        generateArrayDimensions: vi.fn(() => "[3]"),
        getStringConcatOperands: vi.fn(() => null),
        getSubstringOperands: vi.fn(() => null),
        getStringLiteralLength: vi.fn((literal) => literal.length - 2),
        getStringExprCapacity: vi.fn(() => null),
        requireStringInclude: vi.fn(),
      });

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
        helperWithArray.generateStringDecl(
          typeCtx,
          "labels",
          expression,
          arrayDims,
          { extern: "", const: "", atomic: "", volatile: "" },
          false,
        ),
      ).toThrow("Array size mismatch - declared [3] but got 2 elements");
    });

    it("throws error for string array initialization from variable", () => {
      // Reset array init state to simulate non-array-initializer
      arrayInitState.lastArrayInitCount = 0;
      arrayInitState.lastArrayFillValue = undefined;

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
        helper.generateStringDecl(
          typeCtx,
          "labels",
          expression,
          arrayDims,
          { extern: "", const: "", atomic: "", volatile: "" },
          false,
        ),
      ).toThrow("String array initialization from variables not supported");
    });

    it("generates string array with modifiers", () => {
      const sharedArrayInitState = {
        lastArrayInitCount: 0,
        lastArrayFillValue: undefined as string | undefined,
      };

      const helperWithArray = new StringDeclHelper({
        typeRegistry,
        getInFunctionBody: () => true,
        getIndentLevel: () => 1,
        arrayInitState: sharedArrayInitState,
        localArrays,
        generateExpression: vi.fn(() => {
          sharedArrayInitState.lastArrayInitCount = 2;
          sharedArrayInitState.lastArrayFillValue = undefined;
          return '{"A", "B"}';
        }),
        generateArrayDimensions: vi.fn(() => "[2]"),
        getStringConcatOperands: vi.fn(() => null),
        getSubstringOperands: vi.fn(() => null),
        getStringLiteralLength: vi.fn((literal) => literal.length - 2),
        getStringExprCapacity: vi.fn(() => null),
        requireStringInclude: vi.fn(),
      });

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

      const result = helperWithArray.generateStringDecl(
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
      );

      expect(result.code).toContain("extern const volatile char data");
    });

    it("handles non-numeric array dimension (macro)", () => {
      const sharedArrayInitState = {
        lastArrayInitCount: 0,
        lastArrayFillValue: undefined as string | undefined,
      };

      const helperWithArray = new StringDeclHelper({
        typeRegistry,
        getInFunctionBody: () => true,
        getIndentLevel: () => 1,
        arrayInitState: sharedArrayInitState,
        localArrays,
        generateExpression: vi.fn(() => {
          sharedArrayInitState.lastArrayInitCount = 2;
          sharedArrayInitState.lastArrayFillValue = undefined;
          return '{"A", "B"}';
        }),
        generateArrayDimensions: vi.fn(() => "[ARRAY_SIZE]"),
        getStringConcatOperands: vi.fn(() => null),
        getSubstringOperands: vi.fn(() => null),
        getStringLiteralLength: vi.fn((literal) => literal.length - 2),
        getStringExprCapacity: vi.fn(() => null),
        requireStringInclude: vi.fn(),
      });

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
      const result = helperWithArray.generateStringDecl(
        typeCtx,
        "data",
        expression,
        arrayDims,
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
      );

      expect(result.handled).toBe(true);
    });

    it("tracks local arrays in localArrays set", () => {
      const sharedArrayInitState = {
        lastArrayInitCount: 0,
        lastArrayFillValue: undefined as string | undefined,
      };

      const localArraysSet = new Set<string>();

      const helperWithTracking = new StringDeclHelper({
        typeRegistry,
        getInFunctionBody: () => true,
        getIndentLevel: () => 1,
        arrayInitState: sharedArrayInitState,
        localArrays: localArraysSet,
        generateExpression: vi.fn(() => {
          sharedArrayInitState.lastArrayInitCount = 2;
          sharedArrayInitState.lastArrayFillValue = undefined;
          return '{"X", "Y"}';
        }),
        generateArrayDimensions: vi.fn(() => "[2]"),
        getStringConcatOperands: vi.fn(() => null),
        getSubstringOperands: vi.fn(() => null),
        getStringLiteralLength: vi.fn((literal) => literal.length - 2),
        getStringExprCapacity: vi.fn(() => null),
        requireStringInclude: vi.fn(),
      });

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

      helperWithTracking.generateStringDecl(
        typeCtx,
        "tracked",
        expression,
        arrayDims,
        { extern: "", const: "", atomic: "", volatile: "" },
        false,
      );

      expect(localArraysSet.has("tracked")).toBe(true);
    });
  });
});
