/**
 * Unit tests for MemberChainAnalyzer
 *
 * Issue #644: Tests for the extracted member chain analyzer.
 * Updated to use unified postfixTargetOp grammar after consolidation.
 * Migrated to use CodeGenState instead of constructor DI.
 *
 * #1445: the chain is `TPlannedTargetOp[]` now, so these build values rather
 * than mock parse contexts cast `as unknown as Parser.AssignmentTargetContext`
 * -- a cast that made the whole surface invisible to the type checker.
 *
 * The thunks also let a test assert something the callback version could not:
 * that a chain the walk rejects renders NO index. Rendering one queues a
 * pending temp declaration, so an eager version would leak one per rejected
 * chain.
 */

import { describe, it, expect, beforeEach } from "vitest";
import MemberChainAnalyzer from "../MemberChainAnalyzer";
import CodeGenState from "../../../../../transpiler/state/CodeGenState";
import SymbolTable from "../../../../../transpiler/state/SymbolTable";
import createMockSymbols from "../../../../../transpiler/__tests__/codeGenSymbolsHelpers";
import type TPlannedTargetOp from "../../../../../transpiler/types/TPlannedTargetOp";

/** A member access step: `.memberName` */
function member(name: string): TPlannedTargetOp {
  return { kind: "member", name };
}

/** A single-index subscript step: `[expr]` */
function subscript(index: string): TPlannedTargetOp {
  return { kind: "subscript", indexCount: 1, renderIndexes: () => [index] };
}

/** A bit-range step: `[start, width]` */
function bitRange(start: string, width: string): TPlannedTargetOp {
  return {
    kind: "subscript",
    indexCount: 2,
    renderIndexes: () => [start, width],
  };
}

describe("MemberChainAnalyzer", () => {
  beforeEach(() => {
    CodeGenState.reset();
  });

  /** A base identifier and the chain applied to it. */
  function createTarget(
    baseName: string | null,
    ops: TPlannedTargetOp[],
  ): { baseName: string | null; ops: TPlannedTargetOp[] } {
    return { baseName, ops };
  }

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

    // Also mark struct as known (for isKnownStruct checks).
    // #1445: this wrote out all 23 fields of ICodeGenSymbols by hand, a copy
    // of `createMockSymbols` that a new field would have broken silently.
    CodeGenState.symbols ??= createMockSymbols({});
    (CodeGenState.symbols.knownStructs as Set<string>).add(structName);
  }

  describe("analyze", () => {
    it("returns isBitAccess false when no base identifier", () => {
      const target = createTarget(null, []);
      const result = MemberChainAnalyzer.analyze(target.baseName, target.ops);
      expect(result.isBitAccess).toBe(false);
    });

    it("returns isBitAccess false when no postfix operations", () => {
      const target = createTarget("x", []);
      const result = MemberChainAnalyzer.analyze(target.baseName, target.ops);
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

      const target = createTarget("point", [member("flags")]);
      const result = MemberChainAnalyzer.analyze(target.baseName, target.ops);
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

      const target = createTarget("flags", [bitRange("0", "8")]);
      const result = MemberChainAnalyzer.analyze(target.baseName, target.ops);
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

      const target = createTarget("point", [member("flags"), subscript("3")]);

      const result = MemberChainAnalyzer.analyze(target.baseName, target.ops);

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

      const target = createTarget("grid", [member("items"), subscript("0")]);

      const result = MemberChainAnalyzer.analyze(target.baseName, target.ops);

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

      const target = createTarget("point", [member("name"), subscript("0")]);

      const result = MemberChainAnalyzer.analyze(target.baseName, target.ops);

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

      const target = createTarget("devices", [
        subscript("0"),
        member("flags"),
        subscript("7"),
      ]);

      const result = MemberChainAnalyzer.analyze(target.baseName, target.ops);

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

      const target = createTarget("matrix", [subscript("0"), subscript("1")]);

      const result = MemberChainAnalyzer.analyze(target.baseName, target.ops);

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

      const target = createTarget("matrix", [
        subscript("0"),
        subscript("1"),
        subscript("3"),
      ]);

      const result = MemberChainAnalyzer.analyze(target.baseName, target.ops);

      expect(result.isBitAccess).toBe(true);
      expect(result.baseTarget).toBe("matrix[0][1]");
      expect(result.bitIndex).toBe("3");
      expect(result.baseType).toBe("u8");
    });

    it("returns false for unknown base variable", () => {
      // unknownVar.field[0] - unknownVar not in typeRegistry
      const target = createTarget("unknownVar", [
        member("field"),
        subscript("0"),
      ]);

      const result = MemberChainAnalyzer.analyze(target.baseName, target.ops);

      expect(result.isBitAccess).toBe(false);
    });

    /**
     * The laziness, asserted rather than commented. Rendering an index queues
     * a pending temp declaration in some shapes, so a chain the walk rejects
     * must render nothing -- and most chains are rejected.
     */
    it("renders no index for a chain that is not bit access", () => {
      CodeGenState.setVariableTypeInfo("matrix", {
        baseType: "u8",
        bitWidth: 8,
        isArray: true,
        isConst: false,
        arrayDimensions: [4, 4],
      });

      let rendered = 0;
      const counting = (index: string): TPlannedTargetOp => ({
        kind: "subscript",
        indexCount: 1,
        renderIndexes: () => {
          rendered += 1;
          return [index];
        },
      });

      // matrix[0][1] is 2D array access, so the walk rejects it.
      const result = MemberChainAnalyzer.analyze("matrix", [
        counting("0"),
        counting("1"),
      ]);

      expect(result.isBitAccess).toBe(false);
      expect(rendered).toBe(0);
    });

    it("returns false for member access on non-struct", () => {
      // x.field[0] where x is a primitive
      CodeGenState.setVariableTypeInfo("x", {
        baseType: "u32",
        bitWidth: 32,
        isArray: false,
        isConst: false,
      });

      const target = createTarget("x", [member("field"), subscript("0")]);

      const result = MemberChainAnalyzer.analyze(target.baseName, target.ops);

      expect(result.isBitAccess).toBe(false);
    });
  });
});
