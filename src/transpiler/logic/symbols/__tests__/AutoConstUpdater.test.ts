/**
 * Unit tests for AutoConstUpdater.
 * Issue #588: Extracted from Transpiler to logic layer.
 */

import { describe, expect, it } from "vitest";
import AutoConstUpdater from "../AutoConstUpdater";
import ISymbol from "../../../../utils/types/ISymbol";
import ESymbolKind from "../../../../utils/types/ESymbolKind";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";

describe("AutoConstUpdater", () => {
  // Helper to create a function symbol with parameters
  function createFunctionSymbol(
    name: string,
    parameters: NonNullable<ISymbol["parameters"]>,
  ): ISymbol {
    return {
      name,
      kind: ESymbolKind.Function,
      sourceFile: "/test/file.cnx",
      sourceLine: 1,
      sourceLanguage: ESourceLanguage.CNext,
      isExported: true,
      parameters,
    };
  }

  describe("update", () => {
    it("should mark unmodified struct parameters as auto-const", () => {
      const symbols: ISymbol[] = [
        createFunctionSymbol("processData", [
          { name: "data", type: "DataPacket", isConst: false, isArray: false },
        ]),
      ];
      const unmodifiedParams = new Map<string, Set<string>>([
        ["processData", new Set(["data"])],
      ]);
      const knownEnums = new Set<string>();

      AutoConstUpdater.update(symbols, unmodifiedParams, knownEnums);

      expect(symbols[0].parameters![0].isAutoConst).toBe(true);
    });

    it("should not mark modified parameters as auto-const", () => {
      const symbols: ISymbol[] = [
        createFunctionSymbol("modifyData", [
          { name: "data", type: "DataPacket", isConst: false, isArray: false },
        ]),
      ];
      // Empty set means all parameters were modified
      const unmodifiedParams = new Map<string, Set<string>>([
        ["modifyData", new Set<string>()],
      ]);
      const knownEnums = new Set<string>();

      AutoConstUpdater.update(symbols, unmodifiedParams, knownEnums);

      expect(symbols[0].parameters![0].isAutoConst).toBeUndefined();
    });

    it("should not mark f32 parameters as auto-const (primitive type)", () => {
      const symbols: ISymbol[] = [
        createFunctionSymbol("processFloat", [
          { name: "value", type: "f32", isConst: false, isArray: false },
        ]),
      ];
      const unmodifiedParams = new Map<string, Set<string>>([
        ["processFloat", new Set(["value"])],
      ]);
      const knownEnums = new Set<string>();

      AutoConstUpdater.update(symbols, unmodifiedParams, knownEnums);

      expect(symbols[0].parameters![0].isAutoConst).toBeUndefined();
    });

    it("should not mark f64 parameters as auto-const (primitive type)", () => {
      const symbols: ISymbol[] = [
        createFunctionSymbol("processDouble", [
          { name: "value", type: "f64", isConst: false, isArray: false },
        ]),
      ];
      const unmodifiedParams = new Map<string, Set<string>>([
        ["processDouble", new Set(["value"])],
      ]);
      const knownEnums = new Set<string>();

      AutoConstUpdater.update(symbols, unmodifiedParams, knownEnums);

      expect(symbols[0].parameters![0].isAutoConst).toBeUndefined();
    });

    it("should not mark ISR parameters as auto-const", () => {
      const symbols: ISymbol[] = [
        createFunctionSymbol("handleInterrupt", [
          { name: "handler", type: "ISR", isConst: false, isArray: false },
        ]),
      ];
      const unmodifiedParams = new Map<string, Set<string>>([
        ["handleInterrupt", new Set(["handler"])],
      ]);
      const knownEnums = new Set<string>();

      AutoConstUpdater.update(symbols, unmodifiedParams, knownEnums);

      expect(symbols[0].parameters![0].isAutoConst).toBeUndefined();
    });

    it("should not mark enum parameters as auto-const", () => {
      const symbols: ISymbol[] = [
        createFunctionSymbol("setStatus", [
          { name: "status", type: "Status", isConst: false, isArray: false },
        ]),
      ];
      const unmodifiedParams = new Map<string, Set<string>>([
        ["setStatus", new Set(["status"])],
      ]);
      const knownEnums = new Set<string>(["Status"]);

      AutoConstUpdater.update(symbols, unmodifiedParams, knownEnums);

      expect(symbols[0].parameters![0].isAutoConst).toBeUndefined();
    });

    it("should not mark already-const parameters", () => {
      const symbols: ISymbol[] = [
        createFunctionSymbol("readData", [
          { name: "data", type: "DataPacket", isConst: true, isArray: false },
        ]),
      ];
      const unmodifiedParams = new Map<string, Set<string>>([
        ["readData", new Set(["data"])],
      ]);
      const knownEnums = new Set<string>();

      AutoConstUpdater.update(symbols, unmodifiedParams, knownEnums);

      // Should not have isAutoConst since it's already explicitly const
      expect(symbols[0].parameters![0].isAutoConst).toBeUndefined();
    });

    it("should mark unmodified array parameters as auto-const", () => {
      const symbols: ISymbol[] = [
        createFunctionSymbol("readBuffer", [
          { name: "buffer", type: "u8", isConst: false, isArray: true },
        ]),
      ];
      const unmodifiedParams = new Map<string, Set<string>>([
        ["readBuffer", new Set(["buffer"])],
      ]);
      const knownEnums = new Set<string>();

      AutoConstUpdater.update(symbols, unmodifiedParams, knownEnums);

      expect(symbols[0].parameters![0].isAutoConst).toBe(true);
    });

    it("should not mark const array parameters as auto-const", () => {
      const symbols: ISymbol[] = [
        createFunctionSymbol("readBuffer", [
          { name: "buffer", type: "u8", isConst: true, isArray: true },
        ]),
      ];
      const unmodifiedParams = new Map<string, Set<string>>([
        ["readBuffer", new Set(["buffer"])],
      ]);
      const knownEnums = new Set<string>();

      AutoConstUpdater.update(symbols, unmodifiedParams, knownEnums);

      expect(symbols[0].parameters![0].isAutoConst).toBeUndefined();
    });

    it("should skip non-function symbols", () => {
      const symbols: ISymbol[] = [
        {
          name: "counter",
          kind: ESymbolKind.Variable,
          sourceFile: "/test/file.cnx",
          sourceLine: 1,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: true,
        },
      ];
      const unmodifiedParams = new Map<string, Set<string>>();
      const knownEnums = new Set<string>();

      // Should not throw
      AutoConstUpdater.update(symbols, unmodifiedParams, knownEnums);
    });

    it("should skip functions without parameters", () => {
      const symbols: ISymbol[] = [
        {
          name: "init",
          kind: ESymbolKind.Function,
          sourceFile: "/test/file.cnx",
          sourceLine: 1,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: true,
          // No parameters
        },
      ];
      const unmodifiedParams = new Map<string, Set<string>>([
        ["init", new Set<string>()],
      ]);
      const knownEnums = new Set<string>();

      // Should not throw
      AutoConstUpdater.update(symbols, unmodifiedParams, knownEnums);
    });

    it("should skip functions not in unmodifiedParams map", () => {
      const symbols: ISymbol[] = [
        createFunctionSymbol("unknownFunc", [
          { name: "data", type: "DataPacket", isConst: false, isArray: false },
        ]),
      ];
      // Function not in map
      const unmodifiedParams = new Map<string, Set<string>>();
      const knownEnums = new Set<string>();

      AutoConstUpdater.update(symbols, unmodifiedParams, knownEnums);

      expect(symbols[0].parameters![0].isAutoConst).toBeUndefined();
    });

    it("should handle multiple parameters with mixed modifications", () => {
      const symbols: ISymbol[] = [
        createFunctionSymbol("processMultiple", [
          { name: "input", type: "DataPacket", isConst: false, isArray: false },
          { name: "output", type: "Result", isConst: false, isArray: false },
          { name: "count", type: "i32", isConst: false, isArray: false },
        ]),
      ];
      // Only "input" is unmodified
      const unmodifiedParams = new Map<string, Set<string>>([
        ["processMultiple", new Set(["input"])],
      ]);
      const knownEnums = new Set<string>();

      AutoConstUpdater.update(symbols, unmodifiedParams, knownEnums);

      expect(symbols[0].parameters![0].isAutoConst).toBe(true); // input - unmodified struct
      expect(symbols[0].parameters![1].isAutoConst).toBeUndefined(); // output - modified
      expect(symbols[0].parameters![2].isAutoConst).toBeUndefined(); // count - modified
    });

    it("should handle multiple functions", () => {
      const symbols: ISymbol[] = [
        createFunctionSymbol("func1", [
          { name: "a", type: "StructA", isConst: false, isArray: false },
        ]),
        createFunctionSymbol("func2", [
          { name: "b", type: "StructB", isConst: false, isArray: false },
        ]),
      ];
      const unmodifiedParams = new Map<string, Set<string>>([
        ["func1", new Set(["a"])],
        ["func2", new Set<string>()], // b is modified
      ]);
      const knownEnums = new Set<string>();

      AutoConstUpdater.update(symbols, unmodifiedParams, knownEnums);

      expect(symbols[0].parameters![0].isAutoConst).toBe(true); // func1.a
      expect(symbols[1].parameters![0].isAutoConst).toBeUndefined(); // func2.b
    });
  });

  describe("shouldMarkAutoConst", () => {
    it("should return true for unmodified struct parameter", () => {
      const param = {
        name: "data",
        type: "DataPacket",
        isConst: false,
        isArray: false,
      };
      const unmodified = new Set(["data"]);
      const knownEnums = new Set<string>();

      const result = AutoConstUpdater.shouldMarkAutoConst(
        param,
        unmodified,
        knownEnums,
      );

      expect(result).toBe(true);
    });

    it("should return false for modified parameter", () => {
      const param = {
        name: "data",
        type: "DataPacket",
        isConst: false,
        isArray: false,
      };
      const unmodified = new Set<string>(); // Empty = all modified
      const knownEnums = new Set<string>();

      const result = AutoConstUpdater.shouldMarkAutoConst(
        param,
        unmodified,
        knownEnums,
      );

      expect(result).toBe(false);
    });

    it("should return false for already-const parameter", () => {
      const param = {
        name: "data",
        type: "DataPacket",
        isConst: true,
        isArray: false,
      };
      const unmodified = new Set(["data"]);
      const knownEnums = new Set<string>();

      const result = AutoConstUpdater.shouldMarkAutoConst(
        param,
        unmodified,
        knownEnums,
      );

      expect(result).toBe(false);
    });

    it("should return true for unmodified non-const array parameter", () => {
      const param = {
        name: "buffer",
        type: "u8",
        isConst: false,
        isArray: true,
      };
      const unmodified = new Set(["buffer"]);
      const knownEnums = new Set<string>();

      const result = AutoConstUpdater.shouldMarkAutoConst(
        param,
        unmodified,
        knownEnums,
      );

      expect(result).toBe(true);
    });

    it("should return false for f32 type", () => {
      const param = { name: "x", type: "f32", isConst: false, isArray: false };
      const unmodified = new Set(["x"]);
      const knownEnums = new Set<string>();

      const result = AutoConstUpdater.shouldMarkAutoConst(
        param,
        unmodified,
        knownEnums,
      );

      expect(result).toBe(false);
    });

    it("should return false for f64 type", () => {
      const param = { name: "x", type: "f64", isConst: false, isArray: false };
      const unmodified = new Set(["x"]);
      const knownEnums = new Set<string>();

      const result = AutoConstUpdater.shouldMarkAutoConst(
        param,
        unmodified,
        knownEnums,
      );

      expect(result).toBe(false);
    });

    it("should return false for ISR type", () => {
      const param = {
        name: "handler",
        type: "ISR",
        isConst: false,
        isArray: false,
      };
      const unmodified = new Set(["handler"]);
      const knownEnums = new Set<string>();

      const result = AutoConstUpdater.shouldMarkAutoConst(
        param,
        unmodified,
        knownEnums,
      );

      expect(result).toBe(false);
    });

    it("should return false for enum type", () => {
      const param = {
        name: "status",
        type: "Status",
        isConst: false,
        isArray: false,
      };
      const unmodified = new Set(["status"]);
      const knownEnums = new Set(["Status"]);

      const result = AutoConstUpdater.shouldMarkAutoConst(
        param,
        unmodified,
        knownEnums,
      );

      expect(result).toBe(false);
    });
  });
});
