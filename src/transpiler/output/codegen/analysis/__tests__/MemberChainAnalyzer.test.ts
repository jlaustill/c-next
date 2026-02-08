/**
 * Unit tests for MemberChainAnalyzer
 *
 * Issue #644: Tests for the extracted member chain analyzer.
 * Updated to use unified postfixTargetOp grammar after consolidation.
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

/** Mock type for PostfixTargetOpContext */
interface IMockPostfixOp {
  IDENTIFIER: () => { getText: () => string } | null;
  expression: () => { getText: () => string }[];
}

/**
 * Create a mock PostfixTargetOpContext for member access: .memberName
 */
function createMemberOp(memberName: string): IMockPostfixOp {
  return {
    IDENTIFIER: () => ({ getText: () => memberName }),
    expression: () => [],
  };
}

/**
 * Create a mock PostfixTargetOpContext for subscript access: [expr]
 */
function createSubscriptOp(exprValue: string): IMockPostfixOp {
  return {
    IDENTIFIER: () => null,
    expression: () => [{ getText: () => exprValue }],
  };
}

/**
 * Create a mock PostfixTargetOpContext for bit range access: [start, width]
 */
function createBitRangeOp(start: string, width: string): IMockPostfixOp {
  return {
    IDENTIFIER: () => null,
    expression: () => [{ getText: () => start }, { getText: () => width }],
  };
}

/**
 * Create a mock AssignmentTargetContext
 */
function createTargetCtx(baseId: string | null, postfixOps: IMockPostfixOp[]) {
  return {
    IDENTIFIER: () => (baseId ? { getText: () => baseId } : null),
    postfixTargetOp: () => postfixOps,
  } as unknown as Parser.AssignmentTargetContext;
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
      generateExpression: vi.fn((ctx) =>
        (ctx as { getText(): string }).getText(),
      ),
    };

    analyzer = new MemberChainAnalyzer(deps);
  });

  describe("analyze", () => {
    it("returns isBitAccess false when no base identifier", () => {
      const targetCtx = createTargetCtx(null, []);
      const result = analyzer.analyze(targetCtx);
      expect(result.isBitAccess).toBe(false);
    });

    it("returns isBitAccess false when no postfix operations", () => {
      const targetCtx = createTargetCtx("x", []);
      const result = analyzer.analyze(targetCtx);
      expect(result.isBitAccess).toBe(false);
    });

    it("returns isBitAccess false when last op is member access", () => {
      // point.flags (no subscript at end)
      typeRegistry.set("point", {
        baseType: "Point",
        bitWidth: 0,
        isArray: false,
        isConst: false,
      });
      const pointFields = new Map<string, string>();
      pointFields.set("flags", "u8");
      structFields.set("Point", pointFields);

      const targetCtx = createTargetCtx("point", [createMemberOp("flags")]);
      const result = analyzer.analyze(targetCtx);
      expect(result.isBitAccess).toBe(false);
    });

    it("returns isBitAccess false when last subscript has 2 expressions (bit range)", () => {
      // flags[0, 8] - bit range, not single bit access
      typeRegistry.set("flags", {
        baseType: "u32",
        bitWidth: 32,
        isArray: false,
        isConst: false,
      });

      const targetCtx = createTargetCtx("flags", [createBitRangeOp("0", "8")]);
      const result = analyzer.analyze(targetCtx);
      expect(result.isBitAccess).toBe(false);
    });

    it("detects bit access on struct member: point.flags[3]", () => {
      // Setup: struct Point { u8 flags; }
      const pointFields = new Map<string, string>();
      pointFields.set("flags", "u8");
      structFields.set("Point", pointFields);
      structFieldArrays.set("Point", new Set());

      typeRegistry.set("point", {
        baseType: "Point",
        bitWidth: 0,
        isArray: false,
        isConst: false,
      });

      const targetCtx = createTargetCtx("point", [
        createMemberOp("flags"),
        createSubscriptOp("3"),
      ]);

      const result = analyzer.analyze(targetCtx);

      expect(result.isBitAccess).toBe(true);
      expect(result.baseTarget).toBe("point.flags");
      expect(result.bitIndex).toBe("3");
      expect(result.baseType).toBe("u8");
    });

    it("returns false for subscript on array member: grid.items[0]", () => {
      // Setup: struct Grid { u8 items[10]; }
      const gridFields = new Map<string, string>();
      gridFields.set("items", "u8");
      structFields.set("Grid", gridFields);
      structFieldArrays.set("Grid", new Set(["items"]));

      typeRegistry.set("grid", {
        baseType: "Grid",
        bitWidth: 0,
        isArray: false,
        isConst: false,
      });

      const targetCtx = createTargetCtx("grid", [
        createMemberOp("items"),
        createSubscriptOp("0"),
      ]);

      const result = analyzer.analyze(targetCtx);

      // items is an array, so [0] is array access, not bit access
      expect(result.isBitAccess).toBe(false);
    });

    it("returns false for non-integer member: point.name[0]", () => {
      // Setup: struct Point { string name; }
      const pointFields = new Map<string, string>();
      pointFields.set("name", "string");
      structFields.set("Point", pointFields);
      structFieldArrays.set("Point", new Set());

      typeRegistry.set("point", {
        baseType: "Point",
        bitWidth: 0,
        isArray: false,
        isConst: false,
      });

      const targetCtx = createTargetCtx("point", [
        createMemberOp("name"),
        createSubscriptOp("0"),
      ]);

      const result = analyzer.analyze(targetCtx);

      // name is a string, not an integer, so no bit access
      expect(result.isBitAccess).toBe(false);
    });

    it("detects bit access through array-of-structs: devices[0].flags[7]", () => {
      // Setup: struct Device { u8 flags; }, Device devices[4];
      const deviceFields = new Map<string, string>();
      deviceFields.set("flags", "u8");
      structFields.set("Device", deviceFields);
      structFieldArrays.set("Device", new Set());

      typeRegistry.set("devices", {
        baseType: "Device",
        bitWidth: 0,
        isArray: true,
        isConst: false,
        arrayDimensions: [4],
      });

      const targetCtx = createTargetCtx("devices", [
        createSubscriptOp("0"),
        createMemberOp("flags"),
        createSubscriptOp("7"),
      ]);

      const result = analyzer.analyze(targetCtx);

      expect(result.isBitAccess).toBe(true);
      expect(result.baseTarget).toBe("devices[0].flags");
      expect(result.bitIndex).toBe("7");
      expect(result.baseType).toBe("u8");
    });

    it("returns false for 2D array element: matrix[0][1]", () => {
      // matrix[0][1] is array access, not bit access
      typeRegistry.set("matrix", {
        baseType: "u8",
        bitWidth: 8,
        isArray: true,
        isConst: false,
        arrayDimensions: [4, 4],
      });

      const targetCtx = createTargetCtx("matrix", [
        createSubscriptOp("0"),
        createSubscriptOp("1"),
      ]);

      const result = analyzer.analyze(targetCtx);

      // This is 2D array access, not bit access
      expect(result.isBitAccess).toBe(false);
    });

    it("detects bit access on 2D array element: matrix[0][1][3]", () => {
      // matrix[0][1][3] where matrix is u8[4][4]
      // The third subscript [3] is bit access on the u8 element
      typeRegistry.set("matrix", {
        baseType: "u8",
        bitWidth: 8,
        isArray: true,
        isConst: false,
        arrayDimensions: [4, 4],
      });

      const targetCtx = createTargetCtx("matrix", [
        createSubscriptOp("0"),
        createSubscriptOp("1"),
        createSubscriptOp("3"),
      ]);

      const result = analyzer.analyze(targetCtx);

      expect(result.isBitAccess).toBe(true);
      expect(result.baseTarget).toBe("matrix[0][1]");
      expect(result.bitIndex).toBe("3");
      expect(result.baseType).toBe("u8");
    });

    it("returns false for unknown base variable", () => {
      // unknownVar.field[0] - unknownVar not in typeRegistry
      const targetCtx = createTargetCtx("unknownVar", [
        createMemberOp("field"),
        createSubscriptOp("0"),
      ]);

      const result = analyzer.analyze(targetCtx);

      expect(result.isBitAccess).toBe(false);
    });

    it("returns false for member access on non-struct", () => {
      // x.field[0] where x is a primitive
      typeRegistry.set("x", {
        baseType: "u32",
        bitWidth: 32,
        isArray: false,
        isConst: false,
      });

      const targetCtx = createTargetCtx("x", [
        createMemberOp("field"),
        createSubscriptOp("0"),
      ]);

      const result = analyzer.analyze(targetCtx);

      expect(result.isBitAccess).toBe(false);
    });
  });
});
