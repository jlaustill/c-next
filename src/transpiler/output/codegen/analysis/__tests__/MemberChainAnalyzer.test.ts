/**
 * Unit tests for MemberChainAnalyzer
 *
 * Issue #644: Tests for the extracted member chain analyzer.
 * Updated to use unified postfixTargetOp grammar after consolidation.
 * Migrated to use CodeGenState instead of constructor DI.
 */

import { describe, it, expect, beforeEach } from "vitest";
import MemberChainAnalyzer from "../MemberChainAnalyzer.js";
import CodeGenState from "../../../../state/CodeGenState.js";
import SymbolTable from "../../../../logic/symbols/SymbolTable.js";
import type * as Parser from "../../../../logic/parser/grammar/CNextParser.js";

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

/**
 * Mock generateExpression callback - just returns getText() of the context
 */
function mockGenerateExpression(ctx: Parser.ExpressionContext): string {
  return (ctx as unknown as { getText(): string }).getText();
}

describe("MemberChainAnalyzer", () => {
  beforeEach(() => {
    CodeGenState.reset();
  });

  /**
   * Helper to set up struct fields in CodeGenState.symbolTable
   * Issue #831: SymbolTable is now the single source of truth for struct fields
   */
  function setupStructFields(
    structName: string,
    fields: Map<string, string>,
    arrayFields: Set<string> = new Set(),
  ): void {
    // Initialize symbolTable if not set
    if (!CodeGenState.symbolTable) {
      CodeGenState.symbolTable = new SymbolTable();
    }

    // Register struct fields in SymbolTable
    for (const [fieldName, fieldType] of fields) {
      const isArray = arrayFields.has(fieldName);
      CodeGenState.symbolTable.addStructField(
        structName,
        fieldName,
        fieldType,
        isArray ? [10] : undefined, // Use realistic dimension for arrays
      );
    }

    // Also mark struct as known (for isKnownStruct checks)
    if (!CodeGenState.symbols) {
      CodeGenState.symbols = {
        knownStructs: new Set(),
        knownScopes: new Set(),
        knownEnums: new Set(),
        knownBitmaps: new Set(),
        knownRegisters: new Set(),
        structFields: new Map(),
        structFieldArrays: new Map(),
        structFieldDimensions: new Map(),
        enumMembers: new Map(),
        bitmapFields: new Map(),
        bitmapBackingType: new Map(),
        bitmapBitWidth: new Map(),
        scopeMembers: new Map(),
        scopeMemberVisibility: new Map(),
        scopedRegisters: new Map(),
        registerMemberAccess: new Map(),
        registerMemberTypes: new Map(),
        registerBaseAddresses: new Map(),
        registerMemberOffsets: new Map(),
        registerMemberCTypes: new Map(),
        scopeVariableUsage: new Map(),
        scopePrivateConstValues: new Map(),
        functionReturnTypes: new Map(),
        getSingleFunctionForVariable: () => null,
        opaqueTypes: new Set(),
        hasPublicSymbols: () => false,
      };
    }
    (CodeGenState.symbols.knownStructs as Set<string>).add(structName);
  }

  describe("analyze", () => {
    it("returns isBitAccess false when no base identifier", () => {
      const targetCtx = createTargetCtx(null, []);
      const result = MemberChainAnalyzer.analyze(
        targetCtx,
        mockGenerateExpression,
      );
      expect(result.isBitAccess).toBe(false);
    });

    it("returns isBitAccess false when no postfix operations", () => {
      const targetCtx = createTargetCtx("x", []);
      const result = MemberChainAnalyzer.analyze(
        targetCtx,
        mockGenerateExpression,
      );
      expect(result.isBitAccess).toBe(false);
    });

    it("returns isBitAccess false when last op is member access", () => {
      // point.flags (no subscript at end)
      CodeGenState.setVariableTypeInfo("point", {
        baseType: "Point",
        bitWidth: 0,
        isArray: false,
        isConst: false,
      });
      const pointFields = new Map<string, string>();
      pointFields.set("flags", "u8");
      setupStructFields("Point", pointFields);

      const targetCtx = createTargetCtx("point", [createMemberOp("flags")]);
      const result = MemberChainAnalyzer.analyze(
        targetCtx,
        mockGenerateExpression,
      );
      expect(result.isBitAccess).toBe(false);
    });

    it("returns isBitAccess false when last subscript has 2 expressions (bit range)", () => {
      // flags[0, 8] - bit range, not single bit access
      CodeGenState.setVariableTypeInfo("flags", {
        baseType: "u32",
        bitWidth: 32,
        isArray: false,
        isConst: false,
      });

      const targetCtx = createTargetCtx("flags", [createBitRangeOp("0", "8")]);
      const result = MemberChainAnalyzer.analyze(
        targetCtx,
        mockGenerateExpression,
      );
      expect(result.isBitAccess).toBe(false);
    });

    it("detects bit access on struct member: point.flags[3]", () => {
      // Setup: struct Point { u8 flags; }
      const pointFields = new Map<string, string>();
      pointFields.set("flags", "u8");
      setupStructFields("Point", pointFields);

      CodeGenState.setVariableTypeInfo("point", {
        baseType: "Point",
        bitWidth: 0,
        isArray: false,
        isConst: false,
      });

      const targetCtx = createTargetCtx("point", [
        createMemberOp("flags"),
        createSubscriptOp("3"),
      ]);

      const result = MemberChainAnalyzer.analyze(
        targetCtx,
        mockGenerateExpression,
      );

      expect(result.isBitAccess).toBe(true);
      expect(result.baseTarget).toBe("point.flags");
      expect(result.bitIndex).toBe("3");
      expect(result.baseType).toBe("u8");
    });

    it("returns false for subscript on array member: grid.items[0]", () => {
      // Setup: struct Grid { u8 items[10]; }
      const gridFields = new Map<string, string>();
      gridFields.set("items", "u8");
      setupStructFields("Grid", gridFields, new Set(["items"]));

      CodeGenState.setVariableTypeInfo("grid", {
        baseType: "Grid",
        bitWidth: 0,
        isArray: false,
        isConst: false,
      });

      const targetCtx = createTargetCtx("grid", [
        createMemberOp("items"),
        createSubscriptOp("0"),
      ]);

      const result = MemberChainAnalyzer.analyze(
        targetCtx,
        mockGenerateExpression,
      );

      // items is an array, so [0] is array access, not bit access
      expect(result.isBitAccess).toBe(false);
    });

    it("returns false for non-integer member: point.name[0]", () => {
      // Setup: struct Point { string name; }
      const pointFields = new Map<string, string>();
      pointFields.set("name", "string");
      setupStructFields("Point", pointFields);

      CodeGenState.setVariableTypeInfo("point", {
        baseType: "Point",
        bitWidth: 0,
        isArray: false,
        isConst: false,
      });

      const targetCtx = createTargetCtx("point", [
        createMemberOp("name"),
        createSubscriptOp("0"),
      ]);

      const result = MemberChainAnalyzer.analyze(
        targetCtx,
        mockGenerateExpression,
      );

      // name is a string, not an integer, so no bit access
      expect(result.isBitAccess).toBe(false);
    });

    it("detects bit access through array-of-structs: devices[0].flags[7]", () => {
      // Setup: struct Device { u8 flags; }, Device devices[4];
      const deviceFields = new Map<string, string>();
      deviceFields.set("flags", "u8");
      setupStructFields("Device", deviceFields);

      CodeGenState.setVariableTypeInfo("devices", {
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

      const result = MemberChainAnalyzer.analyze(
        targetCtx,
        mockGenerateExpression,
      );

      expect(result.isBitAccess).toBe(true);
      expect(result.baseTarget).toBe("devices[0].flags");
      expect(result.bitIndex).toBe("7");
      expect(result.baseType).toBe("u8");
    });

    it("returns false for 2D array element: matrix[0][1]", () => {
      // matrix[0][1] is array access, not bit access
      CodeGenState.setVariableTypeInfo("matrix", {
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

      const result = MemberChainAnalyzer.analyze(
        targetCtx,
        mockGenerateExpression,
      );

      // This is 2D array access, not bit access
      expect(result.isBitAccess).toBe(false);
    });

    it("detects bit access on 2D array element: matrix[0][1][3]", () => {
      // matrix[0][1][3] where matrix is u8[4][4]
      // The third subscript [3] is bit access on the u8 element
      CodeGenState.setVariableTypeInfo("matrix", {
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

      const result = MemberChainAnalyzer.analyze(
        targetCtx,
        mockGenerateExpression,
      );

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

      const result = MemberChainAnalyzer.analyze(
        targetCtx,
        mockGenerateExpression,
      );

      expect(result.isBitAccess).toBe(false);
    });

    it("returns false for member access on non-struct", () => {
      // x.field[0] where x is a primitive
      CodeGenState.setVariableTypeInfo("x", {
        baseType: "u32",
        bitWidth: 32,
        isArray: false,
        isConst: false,
      });

      const targetCtx = createTargetCtx("x", [
        createMemberOp("field"),
        createSubscriptOp("0"),
      ]);

      const result = MemberChainAnalyzer.analyze(
        targetCtx,
        mockGenerateExpression,
      );

      expect(result.isBitAccess).toBe(false);
    });
  });
});
