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
  });
});
