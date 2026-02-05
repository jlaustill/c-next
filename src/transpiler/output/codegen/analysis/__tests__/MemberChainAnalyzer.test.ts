/**
 * Unit tests for MemberChainAnalyzer
 *
 * Issue #644: Tests for the extracted member chain analyzer.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import MemberChainAnalyzer from "../MemberChainAnalyzer.js";
import type TTypeInfo from "../../types/TTypeInfo.js";
import type * as Parser from "../../../../logic/parser/grammar/CNextParser.js";

/** Test-local copy of IMemberChainAnalyzerDeps interface */
interface IMemberChainAnalyzerDeps {
  typeRegistry: ReadonlyMap<string, TTypeInfo>;
  structFields: ReadonlyMap<string, ReadonlyMap<string, string>>;
  structFieldArrays: ReadonlyMap<string, ReadonlySet<string>>;
  isKnownStruct: (name: string) => boolean;
  generateExpression: (ctx: Parser.ExpressionContext) => string;
}

describe("MemberChainAnalyzer", () => {
  let typeRegistry: Map<string, TTypeInfo>;
  let structFields: Map<string, Map<string, string>>;
  let structFieldArrays: Map<string, Set<string>>;
  let deps: IMemberChainAnalyzerDeps;
  let analyzer: MemberChainAnalyzer;

  beforeEach(() => {
    typeRegistry = new Map();
    structFields = new Map();
    structFieldArrays = new Map();

    deps = {
      typeRegistry,
      structFields,
      structFieldArrays,
      isKnownStruct: vi.fn((name) => structFields.has(name)),
      generateExpression: vi.fn((ctx) => ctx.getText()),
    };

    analyzer = new MemberChainAnalyzer(deps);
  });

  describe("analyze", () => {
    it("returns isBitAccess false when no memberAccess context", () => {
      // Create mock context without memberAccess
      const targetCtx = {
        memberAccess: () => null,
      } as never;

      const result = analyzer.analyze(targetCtx);

      expect(result.isBitAccess).toBe(false);
    });

    it("returns isBitAccess false when no expressions", () => {
      const memberAccessCtx = {
        IDENTIFIER: () => [{ getText: () => "point" }],
        expression: () => [],
        children: [{ getText: () => "point" }],
      };

      const targetCtx = {
        memberAccess: () => memberAccessCtx,
      } as never;

      const result = analyzer.analyze(targetCtx);

      expect(result.isBitAccess).toBe(false);
    });

    it("detects bit access on struct member", () => {
      // Setup: struct Point { u8 flags; }
      const pointFields = new Map<string, string>();
      pointFields.set("flags", "u8");
      structFields.set("Point", pointFields);
      structFieldArrays.set("Point", new Set());

      // Variable 'point' is of type Point
      typeRegistry.set("point", {
        baseType: "Point",
        bitWidth: 0,
        isConst: false,
        isArray: false,
      });

      // Mock: point.flags[3]
      const mockExpr = { getText: () => "3" };
      const memberAccessCtx = {
        IDENTIFIER: () => [
          { getText: () => "point" },
          { getText: () => "flags" },
        ],
        expression: () => [mockExpr],
        children: [
          { getText: () => "point" },
          { getText: () => "." },
          { getText: () => "flags" },
          { getText: () => "[" },
          mockExpr,
          { getText: () => "]" },
        ],
      };

      const targetCtx = {
        memberAccess: () => memberAccessCtx,
      } as never;

      const result = analyzer.analyze(targetCtx);

      expect(result.isBitAccess).toBe(true);
      expect(result.baseTarget).toBe("point.flags");
      expect(result.bitIndex).toBe("3");
      expect(result.baseType).toBe("u8");
    });

    it("returns isBitAccess false for array subscript on array field", () => {
      // Setup: struct Data { u8 values[10]; }
      const dataFields = new Map<string, string>();
      dataFields.set("values", "u8");
      structFields.set("Data", dataFields);
      structFieldArrays.set("Data", new Set(["values"]));

      // Variable 'data' is of type Data
      typeRegistry.set("data", {
        baseType: "Data",
        bitWidth: 0,
        isConst: false,
        isArray: false,
      });

      // Mock: data.values[3]
      const mockExpr = { getText: () => "3" };
      const memberAccessCtx = {
        IDENTIFIER: () => [
          { getText: () => "data" },
          { getText: () => "values" },
        ],
        expression: () => [mockExpr],
        children: [
          { getText: () => "data" },
          { getText: () => "." },
          { getText: () => "values" },
          { getText: () => "[" },
          mockExpr,
          { getText: () => "]" },
        ],
      };

      const targetCtx = {
        memberAccess: () => memberAccessCtx,
      } as never;

      const result = analyzer.analyze(targetCtx);

      // values is an array, so [3] is array subscript, not bit access
      expect(result.isBitAccess).toBe(false);
    });

    it("returns isBitAccess false for non-integer field types", () => {
      // Setup: struct Config { f32 value; }
      const configFields = new Map<string, string>();
      configFields.set("value", "f32");
      structFields.set("Config", configFields);
      structFieldArrays.set("Config", new Set());

      typeRegistry.set("config", {
        baseType: "Config",
        bitWidth: 0,
        isConst: false,
        isArray: false,
      });

      // Mock: config.value[3]
      const mockExpr = { getText: () => "3" };
      const memberAccessCtx = {
        IDENTIFIER: () => [
          { getText: () => "config" },
          { getText: () => "value" },
        ],
        expression: () => [mockExpr],
        children: [
          { getText: () => "config" },
          { getText: () => "." },
          { getText: () => "value" },
          { getText: () => "[" },
          mockExpr,
          { getText: () => "]" },
        ],
      };

      const targetCtx = {
        memberAccess: () => memberAccessCtx,
      } as never;

      const result = analyzer.analyze(targetCtx);

      // f32 is not an integer type, so this would be handled differently
      // The analyzer only detects bit access on integer types
      expect(result.isBitAccess).toBe(false);
    });

    it("returns isBitAccess false when children is null", () => {
      const memberAccessCtx = {
        IDENTIFIER: () => [{ getText: () => "point" }],
        expression: () => [{ getText: () => "0" }],
        children: null,
      };

      const targetCtx = {
        memberAccess: () => memberAccessCtx,
      } as never;

      const result = analyzer.analyze(targetCtx);

      expect(result.isBitAccess).toBe(false);
    });

    it("should track type through nested struct member chain", () => {
      // Setup: struct Inner { u8 flags; }, struct Outer { Inner child; }
      const innerFields = new Map<string, string>();
      innerFields.set("flags", "u8");
      structFields.set("Inner", innerFields);
      structFieldArrays.set("Inner", new Set());

      const outerFields = new Map<string, string>();
      outerFields.set("child", "Inner");
      structFields.set("Outer", outerFields);
      structFieldArrays.set("Outer", new Set());

      // Variable 'obj' is of type Outer
      typeRegistry.set("obj", {
        baseType: "Outer",
        bitWidth: 0,
        isConst: false,
        isArray: false,
      });

      // Mock: obj.child.flags[0]
      const mockExpr = { getText: () => "0" };
      const memberAccessCtx = {
        IDENTIFIER: () => [
          { getText: () => "obj" },
          { getText: () => "child" },
          { getText: () => "flags" },
        ],
        expression: () => [mockExpr],
        children: [
          { getText: () => "obj" },
          { getText: () => "." },
          { getText: () => "child" },
          { getText: () => "." },
          { getText: () => "flags" },
          { getText: () => "[" },
          mockExpr,
          { getText: () => "]" },
        ],
      };

      const targetCtx = {
        memberAccess: () => memberAccessCtx,
      } as never;

      const result = analyzer.analyze(targetCtx);

      expect(result.isBitAccess).toBe(true);
      expect(result.baseTarget).toBe("obj.child.flags");
      expect(result.bitIndex).toBe("0");
    });

    it("should return false for nested struct non-integer field subscript", () => {
      // Setup: struct Inner { f32 value; }, struct Outer { Inner child; }
      const innerFields = new Map<string, string>();
      innerFields.set("value", "f32");
      structFields.set("Inner", innerFields);
      structFieldArrays.set("Inner", new Set());

      const outerFields = new Map<string, string>();
      outerFields.set("child", "Inner");
      structFields.set("Outer", outerFields);
      structFieldArrays.set("Outer", new Set());

      typeRegistry.set("obj", {
        baseType: "Outer",
        bitWidth: 0,
        isConst: false,
        isArray: false,
      });

      // Mock: obj.child.value[0]
      const mockExpr = { getText: () => "0" };
      const memberAccessCtx = {
        IDENTIFIER: () => [
          { getText: () => "obj" },
          { getText: () => "child" },
          { getText: () => "value" },
        ],
        expression: () => [mockExpr],
        children: [
          { getText: () => "obj" },
          { getText: () => "." },
          { getText: () => "child" },
          { getText: () => "." },
          { getText: () => "value" },
          { getText: () => "[" },
          mockExpr,
          { getText: () => "]" },
        ],
      };

      const targetCtx = {
        memberAccess: () => memberAccessCtx,
      } as never;

      const result = analyzer.analyze(targetCtx);

      expect(result.isBitAccess).toBe(false);
    });

    it("should detect bit access through array-of-structs subscript", () => {
      // Setup: struct Pixel { u8 flags; }, variable grid:Pixel isArray=true
      const pixelFields = new Map<string, string>();
      pixelFields.set("flags", "u8");
      structFields.set("Pixel", pixelFields);
      structFieldArrays.set("Pixel", new Set());

      typeRegistry.set("grid", {
        baseType: "Pixel",
        bitWidth: 0,
        isConst: false,
        isArray: true,
      });

      // Mock: grid[0].flags[1]
      const mockExpr0 = { getText: () => "0" };
      const mockExpr1 = { getText: () => "1" };
      const memberAccessCtx = {
        IDENTIFIER: () => [
          { getText: () => "grid" },
          { getText: () => "flags" },
        ],
        expression: () => [mockExpr0, mockExpr1],
        children: [
          { getText: () => "grid" },
          { getText: () => "[" },
          mockExpr0,
          { getText: () => "]" },
          { getText: () => "." },
          { getText: () => "flags" },
          { getText: () => "[" },
          mockExpr1,
          { getText: () => "]" },
        ],
      };

      const targetCtx = {
        memberAccess: () => memberAccessCtx,
      } as never;

      const result = analyzer.analyze(targetCtx);

      expect(result.isBitAccess).toBe(true);
      expect(result.baseTarget).toBe("grid[0].flags");
      expect(result.bitIndex).toBe("1");
    });
  });
});
