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
  });
});
