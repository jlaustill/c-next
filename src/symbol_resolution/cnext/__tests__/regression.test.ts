/**
 * Regression tests comparing CNextResolver + TSymbolAdapter vs CNextSymbolCollector.
 *
 * ADR-055 Phase 3: These tests verify the new path produces equivalent output
 * to the old path, ensuring no regressions during migration.
 */

import { describe, expect, it, beforeEach } from "vitest";
import parse from "./testHelpers";
import CNextResolver from "../index";
import TSymbolAdapter from "../adapters/TSymbolAdapter";
import CNextSymbolCollector from "../../CNextSymbolCollector";
import SymbolTable from "../../SymbolTable";
import ESymbolKind from "../../../types/ESymbolKind";

describe("CNextResolver regression", () => {
  let oldSymbolTable: SymbolTable;
  let newSymbolTable: SymbolTable;

  beforeEach(() => {
    oldSymbolTable = new SymbolTable();
    newSymbolTable = new SymbolTable();
  });

  /**
   * Helper to compare symbol arrays, ignoring order.
   * Compares by name and kind since other properties may differ slightly.
   */
  function compareSymbolSets(
    oldSymbols: { name: string; kind: ESymbolKind }[],
    newSymbols: { name: string; kind: ESymbolKind }[],
  ) {
    const oldSet = new Set(oldSymbols.map((s) => `${s.kind}:${s.name}`));
    const newSet = new Set(newSymbols.map((s) => `${s.kind}:${s.name}`));

    const onlyInOld = [...oldSet].filter((s) => !newSet.has(s));
    const onlyInNew = [...newSet].filter((s) => !oldSet.has(s));

    return { oldSet, newSet, onlyInOld, onlyInNew };
  }

  describe("struct equivalence", () => {
    it("produces equivalent struct symbols", () => {
      const code = `
        struct Point {
          i32 x;
          i32 y;
        }

        struct Rectangle {
          Point topLeft;
          Point bottomRight;
        }
      `;

      const tree = parse(code);

      // Old path
      const oldCollector = new CNextSymbolCollector("test.cnx", oldSymbolTable);
      const oldSymbols = oldCollector.collect(tree);
      oldSymbolTable.addSymbols(oldSymbols);

      // New path
      const tSymbols = CNextResolver.resolve(tree, "test.cnx");
      const newSymbols = TSymbolAdapter.toISymbols(tSymbols, newSymbolTable);
      newSymbolTable.addSymbols(newSymbols);

      // Compare struct symbols
      const oldStructs = oldSymbols.filter(
        (s) => s.kind === ESymbolKind.Struct,
      );
      const newStructs = newSymbols.filter(
        (s) => s.kind === ESymbolKind.Struct,
      );

      expect(newStructs).toHaveLength(oldStructs.length);
      expect(newStructs.map((s) => s.name).sort()).toEqual(
        oldStructs.map((s) => s.name).sort(),
      );

      // Compare struct field registration
      expect(newSymbolTable.getStructFields("Point")).toEqual(
        oldSymbolTable.getStructFields("Point"),
      );
      expect(newSymbolTable.getStructFields("Rectangle")).toEqual(
        oldSymbolTable.getStructFields("Rectangle"),
      );
    });
  });

  describe("enum equivalence", () => {
    it("produces equivalent enum symbols", () => {
      const code = `
        enum Color {
          Red,
          Green,
          Blue
        }

        enum State {
          Idle <- 0,
          Running <- 1,
          Error <- 255
        }
      `;

      const tree = parse(code);

      // Old path
      const oldCollector = new CNextSymbolCollector("test.cnx", oldSymbolTable);
      const oldSymbols = oldCollector.collect(tree);

      // New path
      const tSymbols = CNextResolver.resolve(tree, "test.cnx");
      const newSymbols = TSymbolAdapter.toISymbols(tSymbols, newSymbolTable);

      // Compare enum symbols
      const oldEnums = oldSymbols.filter((s) => s.kind === ESymbolKind.Enum);
      const newEnums = newSymbols.filter((s) => s.kind === ESymbolKind.Enum);

      expect(newEnums).toHaveLength(oldEnums.length);
      expect(newEnums.map((s) => s.name).sort()).toEqual(
        oldEnums.map((s) => s.name).sort(),
      );
    });
  });

  describe("bitmap equivalence", () => {
    it("produces equivalent bitmap and bitmap field symbols", () => {
      const code = `
        bitmap8 Status {
          enabled,
          ready,
          error,
          warning,
          reserved[4]
        }

        bitmap16 Control {
          mode[4],
          intensity[8],
          flags[4]
        }
      `;

      const tree = parse(code);

      // Old path
      const oldCollector = new CNextSymbolCollector("test.cnx", oldSymbolTable);
      const oldSymbols = oldCollector.collect(tree);

      // New path
      const tSymbols = CNextResolver.resolve(tree, "test.cnx");
      const newSymbols = TSymbolAdapter.toISymbols(tSymbols, newSymbolTable);

      // Compare bitmap symbols
      const oldBitmaps = oldSymbols.filter(
        (s) => s.kind === ESymbolKind.Bitmap,
      );
      const newBitmaps = newSymbols.filter(
        (s) => s.kind === ESymbolKind.Bitmap,
      );

      expect(newBitmaps).toHaveLength(oldBitmaps.length);
      expect(newBitmaps.map((s) => s.name).sort()).toEqual(
        oldBitmaps.map((s) => s.name).sort(),
      );

      // Compare bitmap field symbols
      const oldFields = oldSymbols.filter(
        (s) => s.kind === ESymbolKind.BitmapField,
      );
      const newFields = newSymbols.filter(
        (s) => s.kind === ESymbolKind.BitmapField,
      );

      expect(newFields).toHaveLength(oldFields.length);
      expect(newFields.map((s) => s.name).sort()).toEqual(
        oldFields.map((s) => s.name).sort(),
      );
    });
  });

  describe("register equivalence", () => {
    it("produces equivalent register and register member symbols", () => {
      const code = `
        register GPIO @ 0x40000000 {
          DATA: u32 rw @ 0x00,
          DIR: u32 rw @ 0x04,
          STATUS: u32 ro @ 0x08
        }
      `;

      const tree = parse(code);

      // Old path
      const oldCollector = new CNextSymbolCollector("test.cnx", oldSymbolTable);
      const oldSymbols = oldCollector.collect(tree);

      // New path
      const tSymbols = CNextResolver.resolve(tree, "test.cnx");
      const newSymbols = TSymbolAdapter.toISymbols(tSymbols, newSymbolTable);

      // Compare register symbols
      const oldRegs = oldSymbols.filter((s) => s.kind === ESymbolKind.Register);
      const newRegs = newSymbols.filter((s) => s.kind === ESymbolKind.Register);

      expect(newRegs).toHaveLength(oldRegs.length);
      expect(newRegs.map((s) => s.name).sort()).toEqual(
        oldRegs.map((s) => s.name).sort(),
      );

      // Compare register member symbols
      const oldMembers = oldSymbols.filter(
        (s) => s.kind === ESymbolKind.RegisterMember,
      );
      const newMembers = newSymbols.filter(
        (s) => s.kind === ESymbolKind.RegisterMember,
      );

      expect(newMembers).toHaveLength(oldMembers.length);
      expect(newMembers.map((s) => s.name).sort()).toEqual(
        oldMembers.map((s) => s.name).sort(),
      );
    });
  });

  describe("scope equivalence", () => {
    it("produces equivalent scope symbols with members", () => {
      const code = `
        scope Motor {
          u32 position;
          public void init() { }
          public void run() { }
          private void calibrate() { }
        }
      `;

      const tree = parse(code);

      // Old path
      const oldCollector = new CNextSymbolCollector("test.cnx", oldSymbolTable);
      const oldSymbols = oldCollector.collect(tree);

      // New path
      const tSymbols = CNextResolver.resolve(tree, "test.cnx");
      const newSymbols = TSymbolAdapter.toISymbols(tSymbols, newSymbolTable);

      // Compare namespace symbols
      const oldNamespaces = oldSymbols.filter(
        (s) => s.kind === ESymbolKind.Namespace,
      );
      const newNamespaces = newSymbols.filter(
        (s) => s.kind === ESymbolKind.Namespace,
      );

      expect(newNamespaces).toHaveLength(oldNamespaces.length);
      expect(newNamespaces.map((s) => s.name).sort()).toEqual(
        oldNamespaces.map((s) => s.name).sort(),
      );

      // Compare function symbols (including scope-prefixed)
      const oldFunctions = oldSymbols.filter(
        (s) => s.kind === ESymbolKind.Function,
      );
      const newFunctions = newSymbols.filter(
        (s) => s.kind === ESymbolKind.Function,
      );

      expect(newFunctions.map((s) => s.name).sort()).toEqual(
        oldFunctions.map((s) => s.name).sort(),
      );

      // Verify visibility is preserved through isExported
      const initFunc = newSymbols.find((s) => s.name === "Motor_init");
      expect(initFunc).toBeDefined();
      expect(initFunc!.isExported).toBe(true);

      const calibrateFunc = newSymbols.find(
        (s) => s.name === "Motor_calibrate",
      );
      expect(calibrateFunc).toBeDefined();
      expect(calibrateFunc!.isExported).toBe(false);
    });
  });

  describe("function equivalence", () => {
    it("produces equivalent function and parameter symbols", () => {
      const code = `
        void main() { }

        i32 add(i32 a, i32 b) {
          return a + b;
        }

        void processArray(const u8 data[10]) { }
      `;

      const tree = parse(code);

      // Old path
      const oldCollector = new CNextSymbolCollector("test.cnx", oldSymbolTable);
      const oldSymbols = oldCollector.collect(tree);

      // New path
      const tSymbols = CNextResolver.resolve(tree, "test.cnx");
      const newSymbols = TSymbolAdapter.toISymbols(tSymbols, newSymbolTable);

      // Compare function symbols
      const oldFunctions = oldSymbols.filter(
        (s) => s.kind === ESymbolKind.Function,
      );
      const newFunctions = newSymbols.filter(
        (s) => s.kind === ESymbolKind.Function,
      );

      expect(newFunctions).toHaveLength(oldFunctions.length);
      expect(newFunctions.map((s) => s.name).sort()).toEqual(
        oldFunctions.map((s) => s.name).sort(),
      );

      // Compare function signatures
      const oldAdd = oldFunctions.find((s) => s.name === "add");
      const newAdd = newFunctions.find((s) => s.name === "add");

      expect(newAdd!.signature).toBe(oldAdd!.signature);
      expect(newAdd!.type).toBe(oldAdd!.type);

      // Compare parameter symbols (for hover support)
      const oldParams = oldSymbols.filter(
        (s) => s.kind === ESymbolKind.Variable && s.parent !== undefined,
      );
      const newParams = newSymbols.filter(
        (s) => s.kind === ESymbolKind.Variable && s.parent !== undefined,
      );

      expect(newParams).toHaveLength(oldParams.length);
    });
  });

  describe("variable equivalence", () => {
    it("produces equivalent variable symbols", () => {
      const code = `
        u32 counter;
        const u32 MAX_SIZE <- 100;
        u8 buffer[256];
      `;

      const tree = parse(code);

      // Old path
      const oldCollector = new CNextSymbolCollector("test.cnx", oldSymbolTable);
      const oldSymbols = oldCollector.collect(tree);

      // New path
      const tSymbols = CNextResolver.resolve(tree, "test.cnx");
      const newSymbols = TSymbolAdapter.toISymbols(tSymbols, newSymbolTable);

      // Compare top-level variable symbols (excluding function parameters)
      const oldVars = oldSymbols.filter(
        (s) => s.kind === ESymbolKind.Variable && !s.parent,
      );
      const newVars = newSymbols.filter(
        (s) => s.kind === ESymbolKind.Variable && !s.parent,
      );

      expect(newVars).toHaveLength(oldVars.length);
      expect(newVars.map((s) => s.name).sort()).toEqual(
        oldVars.map((s) => s.name).sort(),
      );

      // Compare specific properties
      const oldBuffer = oldVars.find((s) => s.name === "buffer");
      const newBuffer = newVars.find((s) => s.name === "buffer");

      expect(newBuffer!.isArray).toBe(oldBuffer!.isArray);
      expect(newBuffer!.size).toBe(oldBuffer!.size);

      const oldMaxSize = oldVars.find((s) => s.name === "MAX_SIZE");
      const newMaxSize = newVars.find((s) => s.name === "MAX_SIZE");

      expect(newMaxSize!.isConst).toBe(oldMaxSize!.isConst);
    });
  });

  describe("comprehensive test", () => {
    it("produces equivalent symbols for comprehensive C-Next code", () => {
      const code = `
        struct Point { i32 x; i32 y; }
        enum Color { Red, Green, Blue }
        bitmap8 Flags { enabled, ready, error, warning, reserved[4] }
        register GPIO @ 0x40000000 {
          DATA: u32 rw @ 0x00
        }
        scope Motor {
          u32 position;
          public void init() { }
        }
        void main() { }
        u32 globalVar;
      `;

      const tree = parse(code);

      // Old path
      const oldCollector = new CNextSymbolCollector("test.cnx", oldSymbolTable);
      const oldSymbols = oldCollector.collect(tree);
      oldSymbolTable.addSymbols(oldSymbols);

      // New path
      const tSymbols = CNextResolver.resolve(tree, "test.cnx");
      const newSymbols = TSymbolAdapter.toISymbols(tSymbols, newSymbolTable);
      newSymbolTable.addSymbols(newSymbols);

      // Compare by kind
      const { onlyInOld, onlyInNew } = compareSymbolSets(
        oldSymbols,
        newSymbols,
      );

      expect(onlyInOld).toEqual([]);
      expect(onlyInNew).toEqual([]);

      // Compare struct field registration
      expect(newSymbolTable.getStructFields("Point")).toEqual(
        oldSymbolTable.getStructFields("Point"),
      );
    });

    it("handles nested bitmaps in scopes", () => {
      const code = `
        scope Motor {
          bitmap8 Status {
            running,
            error,
            warning,
            reserved[5]
          }
        }
      `;

      const tree = parse(code);

      // Old path
      const oldCollector = new CNextSymbolCollector("test.cnx", oldSymbolTable);
      const oldSymbols = oldCollector.collect(tree);

      // New path
      const tSymbols = CNextResolver.resolve(tree, "test.cnx");
      const newSymbols = TSymbolAdapter.toISymbols(tSymbols, newSymbolTable);

      // The scoped bitmap should be named Motor_Status
      const oldBitmap = oldSymbols.find(
        (s) => s.kind === ESymbolKind.Bitmap && s.name === "Motor_Status",
      );
      const newBitmap = newSymbols.find(
        (s) => s.kind === ESymbolKind.Bitmap && s.name === "Motor_Status",
      );

      expect(oldBitmap).toBeDefined();
      expect(newBitmap).toBeDefined();

      // Compare field counts
      const oldFields = oldSymbols.filter(
        (s) =>
          s.kind === ESymbolKind.BitmapField && s.parent === "Motor_Status",
      );
      const newFields = newSymbols.filter(
        (s) =>
          s.kind === ESymbolKind.BitmapField && s.parent === "Motor_Status",
      );

      expect(newFields).toHaveLength(oldFields.length);
    });
  });
});
