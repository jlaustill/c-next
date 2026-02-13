import { describe, it, expect } from "vitest";
import FunctionSymbolAdapter from "../FunctionSymbolAdapter";
import ScopeUtils from "../ScopeUtils";
import ESymbolKind from "../../../utils/types/ESymbolKind";
import type OldIFunctionSymbol from "../../logic/symbols/types/IFunctionSymbol";
import type OldIParameterInfo from "../../logic/symbols/types/IParameterInfo";

describe("FunctionSymbolAdapter", () => {
  // Helper to create an old-style function symbol
  function createOldSymbol(
    overrides: Partial<OldIFunctionSymbol> = {},
  ): OldIFunctionSymbol {
    return {
      kind: ESymbolKind.Function,
      name: "test_func",
      file: "test.cnx",
      line: 10,
      column: 1,
      returnType: "void",
      parameters: [],
      visibility: "public",
      ...overrides,
    };
  }

  // Helper to create an old-style parameter
  function createOldParam(
    overrides: Partial<OldIParameterInfo> = {},
  ): OldIParameterInfo {
    return {
      name: "param",
      type: "u32",
      isConst: false,
      isArray: false,
      ...overrides,
    };
  }

  describe("extractBareName", () => {
    it("returns name unchanged for global scope", () => {
      const globalScope = ScopeUtils.createGlobalScope();
      const result = FunctionSymbolAdapter.extractBareName("main", globalScope);
      expect(result).toBe("main");
    });

    it("extracts bare name from single-level scope", () => {
      const globalScope = ScopeUtils.createGlobalScope();
      const testScope = ScopeUtils.createScope("Test", globalScope);

      const result = FunctionSymbolAdapter.extractBareName(
        "Test_fillData",
        testScope,
      );
      expect(result).toBe("fillData");
    });

    it("extracts bare name from nested scope", () => {
      const globalScope = ScopeUtils.createGlobalScope();
      const outerScope = ScopeUtils.createScope("Test", globalScope);
      const innerScope = ScopeUtils.createScope("Helper", outerScope);

      const result = FunctionSymbolAdapter.extractBareName(
        "Test_Helper_func",
        innerScope,
      );
      expect(result).toBe("func");
    });

    it("extracts bare name from deeply nested scope", () => {
      const globalScope = ScopeUtils.createGlobalScope();
      const level1 = ScopeUtils.createScope("A", globalScope);
      const level2 = ScopeUtils.createScope("B", level1);
      const level3 = ScopeUtils.createScope("C", level2);

      const result = FunctionSymbolAdapter.extractBareName(
        "A_B_C_deepFunc",
        level3,
      );
      expect(result).toBe("deepFunc");
    });

    it("returns name unchanged if prefix does not match", () => {
      const globalScope = ScopeUtils.createGlobalScope();
      const testScope = ScopeUtils.createScope("Test", globalScope);

      // Name doesn't start with "Test_"
      const result = FunctionSymbolAdapter.extractBareName(
        "Other_func",
        testScope,
      );
      expect(result).toBe("Other_func");
    });
  });

  describe("convertParameter", () => {
    it("converts primitive type parameter", () => {
      const oldParam = createOldParam({
        name: "value",
        type: "u32",
        isConst: false,
      });

      const result = FunctionSymbolAdapter.convertParameter(oldParam);

      expect(result.name).toBe("value");
      expect(result.type).toEqual({ kind: "primitive", primitive: "u32" });
      expect(result.isConst).toBe(false);
      expect(result.arrayDimensions).toBeUndefined();
    });

    it("converts const parameter", () => {
      const oldParam = createOldParam({
        name: "config",
        type: "Configuration",
        isConst: true,
      });

      const result = FunctionSymbolAdapter.convertParameter(oldParam);

      expect(result.name).toBe("config");
      expect(result.type).toEqual({ kind: "struct", name: "Configuration" });
      expect(result.isConst).toBe(true);
    });

    it("converts array parameter with numeric dimensions", () => {
      const oldParam = createOldParam({
        name: "buffer",
        type: "u8",
        isConst: false,
        isArray: true,
        arrayDimensions: ["10", "20"],
      });

      const result = FunctionSymbolAdapter.convertParameter(oldParam);

      expect(result.name).toBe("buffer");
      expect(result.type).toEqual({ kind: "primitive", primitive: "u8" });
      expect(result.arrayDimensions).toEqual([10, 20]);
    });

    it("converts array parameter with C macro dimension", () => {
      const oldParam = createOldParam({
        name: "data",
        type: "u8",
        isConst: false,
        isArray: true,
        arrayDimensions: ["BUFFER_SIZE"],
      });

      const result = FunctionSymbolAdapter.convertParameter(oldParam);

      expect(result.arrayDimensions).toEqual(["BUFFER_SIZE"]);
    });

    it("converts array parameter with mixed dimensions", () => {
      const oldParam = createOldParam({
        name: "matrix",
        type: "i32",
        isConst: true,
        isArray: true,
        arrayDimensions: ["10", "COLS"],
      });

      const result = FunctionSymbolAdapter.convertParameter(oldParam);

      expect(result.arrayDimensions).toEqual([10, "COLS"]);
      expect(result.isConst).toBe(true);
    });

    it("converts string type parameter", () => {
      const oldParam = createOldParam({
        name: "message",
        type: "string<32>",
        isConst: false,
      });

      const result = FunctionSymbolAdapter.convertParameter(oldParam);

      expect(result.type).toEqual({ kind: "string", capacity: 32 });
    });

    it("converts enum type parameter", () => {
      const oldParam = createOldParam({
        name: "color",
        type: "EColor",
        isConst: false,
      });

      const result = FunctionSymbolAdapter.convertParameter(oldParam);

      expect(result.type).toEqual({ kind: "enum", name: "EColor" });
    });
  });

  describe("toNew", () => {
    it("converts global scope function", () => {
      const globalScope = ScopeUtils.createGlobalScope();
      const oldSymbol = createOldSymbol({
        name: "main",
        returnType: "u32",
        parameters: [],
        visibility: "public",
        file: "main.cnx",
        line: 5,
      });
      const body = { type: "FunctionBody" };

      const result = FunctionSymbolAdapter.toNew(oldSymbol, globalScope, body);

      expect(result.kind).toBe("function");
      expect(result.name).toBe("main");
      expect(result.scope).toBe(globalScope);
      expect(result.returnType).toEqual({
        kind: "primitive",
        primitive: "u32",
      });
      expect(result.parameters).toEqual([]);
      expect(result.visibility).toBe("public");
      expect(result.body).toBe(body);
      expect(result.sourceFile).toBe("main.cnx");
      expect(result.sourceLine).toBe(5);
    });

    it("converts scoped function with bare name extraction", () => {
      const globalScope = ScopeUtils.createGlobalScope();
      const testScope = ScopeUtils.createScope("Test", globalScope);
      const oldSymbol = createOldSymbol({
        name: "Test_fillData",
        returnType: "void",
        visibility: "private",
        file: "test.cnx",
        line: 20,
      });
      const body = null;

      const result = FunctionSymbolAdapter.toNew(oldSymbol, testScope, body);

      expect(result.name).toBe("fillData");
      expect(result.scope).toBe(testScope);
      expect(result.visibility).toBe("private");
    });

    it("converts function with parameters", () => {
      const globalScope = ScopeUtils.createGlobalScope();
      const oldSymbol = createOldSymbol({
        name: "process",
        returnType: "bool",
        parameters: [
          createOldParam({ name: "data", type: "u8", isConst: true }),
          createOldParam({
            name: "size",
            type: "u32",
            isConst: false,
          }),
        ],
      });

      const result = FunctionSymbolAdapter.toNew(oldSymbol, globalScope, null);

      expect(result.parameters).toHaveLength(2);
      expect(result.parameters[0].name).toBe("data");
      expect(result.parameters[0].type).toEqual({
        kind: "primitive",
        primitive: "u8",
      });
      expect(result.parameters[0].isConst).toBe(true);
      expect(result.parameters[1].name).toBe("size");
      expect(result.parameters[1].type).toEqual({
        kind: "primitive",
        primitive: "u32",
      });
    });

    it("converts function with struct return type", () => {
      const globalScope = ScopeUtils.createGlobalScope();
      const oldSymbol = createOldSymbol({
        name: "createPoint",
        returnType: "Point",
      });

      const result = FunctionSymbolAdapter.toNew(oldSymbol, globalScope, null);

      expect(result.returnType).toEqual({ kind: "struct", name: "Point" });
    });

    it("converts nested scope function", () => {
      const globalScope = ScopeUtils.createGlobalScope();
      const outerScope = ScopeUtils.createScope("Outer", globalScope);
      const innerScope = ScopeUtils.createScope("Inner", outerScope);
      const oldSymbol = createOldSymbol({
        name: "Outer_Inner_helper",
        returnType: "void",
        file: "nested.cnx",
        line: 100,
      });

      const result = FunctionSymbolAdapter.toNew(
        oldSymbol,
        innerScope,
        undefined,
      );

      expect(result.name).toBe("helper");
      expect(result.scope).toBe(innerScope);
      expect(result.sourceFile).toBe("nested.cnx");
      expect(result.sourceLine).toBe(100);
    });

    it("converts function with array parameters", () => {
      const globalScope = ScopeUtils.createGlobalScope();
      const oldSymbol = createOldSymbol({
        name: "processBuffer",
        returnType: "void",
        parameters: [
          createOldParam({
            name: "buffer",
            type: "u8",
            isConst: true,
            isArray: true,
            arrayDimensions: ["256"],
          }),
        ],
      });

      const result = FunctionSymbolAdapter.toNew(oldSymbol, globalScope, null);

      expect(result.parameters[0].arrayDimensions).toEqual([256]);
    });
  });
});
