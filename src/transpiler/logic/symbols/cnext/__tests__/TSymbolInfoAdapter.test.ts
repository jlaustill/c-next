/**
 * Unit tests for TSymbolInfoAdapter.
 * Tests conversion from TSymbol[] to ISymbolInfo interface for CodeGenerator.
 *
 * ADR-055 Phase 5: These tests verify that the adapter correctly converts
 * discriminated union symbols into the flat map format expected by CodeGenerator.
 */

import { describe, expect, it } from "vitest";
import TSymbolInfoAdapter from "../adapters/TSymbolInfoAdapter";
import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import IBitmapSymbol from "../../../../types/symbols/IBitmapSymbol";
import IEnumSymbol from "../../../../types/symbols/IEnumSymbol";
import IStructSymbol from "../../../../types/symbols/IStructSymbol";
import IRegisterSymbol from "../../../../types/symbols/IRegisterSymbol";
import IVariableSymbol from "../../../../types/symbols/IVariableSymbol";
import IFunctionSymbol from "../../../../types/symbols/IFunctionSymbol";
import TypeResolver from "../../../../types/TypeResolver";
import TestScopeUtils from "./testUtils";

describe("TSymbolInfoAdapter", () => {
  // Reset global scope between tests to avoid state pollution
  const globalScope = TestScopeUtils.getGlobalScope();

  describe("convert structs", () => {
    it("should populate knownStructs set", () => {
      const struct: IStructSymbol = {
        kind: "struct",
        name: "Point",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        fields: new Map([
          [
            "x",
            {
              name: "x",
              type: TypeResolver.resolve("i32"),
              isArray: false,
              isConst: false,
              isAtomic: false,
            },
          ],
          [
            "y",
            {
              name: "y",
              type: TypeResolver.resolve("i32"),
              isArray: false,
              isConst: false,
              isAtomic: false,
            },
          ],
        ]),
      };

      const info = TSymbolInfoAdapter.convert([struct]);

      expect(info.knownStructs.has("Point")).toBe(true);
    });

    it("should populate structFields map", () => {
      const struct: IStructSymbol = {
        kind: "struct",
        name: "Point",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        fields: new Map([
          [
            "x",
            {
              name: "x",
              type: TypeResolver.resolve("i32"),
              isArray: false,
              isConst: false,
              isAtomic: false,
            },
          ],
          [
            "y",
            {
              name: "y",
              type: TypeResolver.resolve("f32"),
              isArray: false,
              isConst: false,
              isAtomic: false,
            },
          ],
        ]),
      };

      const info = TSymbolInfoAdapter.convert([struct]);

      expect(info.structFields.get("Point")?.get("x")).toBe("i32");
      expect(info.structFields.get("Point")?.get("y")).toBe("f32");
    });

    it("should populate structFieldArrays for array fields", () => {
      const struct: IStructSymbol = {
        kind: "struct",
        name: "Buffer",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        fields: new Map([
          [
            "data",
            {
              name: "data",
              type: TypeResolver.resolve("u8"),
              isArray: true,
              isConst: false,
              isAtomic: false,
              dimensions: [256],
            },
          ],
          [
            "size",
            {
              name: "size",
              type: TypeResolver.resolve("u32"),
              isArray: false,
              isConst: false,
              isAtomic: false,
            },
          ],
        ]),
      };

      const info = TSymbolInfoAdapter.convert([struct]);

      expect(info.structFieldArrays.get("Buffer")?.has("data")).toBe(true);
      expect(info.structFieldArrays.get("Buffer")?.has("size")).toBe(false);
    });

    it("should populate structFieldDimensions for array fields", () => {
      const struct: IStructSymbol = {
        kind: "struct",
        name: "Matrix",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        fields: new Map([
          [
            "values",
            {
              name: "values",
              type: TypeResolver.resolve("f32"),
              isArray: true,
              isConst: false,
              isAtomic: false,
              dimensions: [4, 4],
            },
          ],
        ]),
      };

      const info = TSymbolInfoAdapter.convert([struct]);

      expect(info.structFieldDimensions.get("Matrix")?.get("values")).toEqual([
        4, 4,
      ]);
    });
  });

  describe("convert enums", () => {
    it("should populate knownEnums set", () => {
      const enumSym: IEnumSymbol = {
        kind: "enum",
        name: "Color",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        members: new Map([
          ["Red", 0],
          ["Green", 1],
          ["Blue", 2],
        ]),
      };

      const info = TSymbolInfoAdapter.convert([enumSym]);

      expect(info.knownEnums.has("Color")).toBe(true);
    });

    it("should populate enumMembers map", () => {
      const enumSym: IEnumSymbol = {
        kind: "enum",
        name: "Priority",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        members: new Map([
          ["LOW", 0],
          ["MEDIUM", 1],
          ["HIGH", 2],
        ]),
      };

      const info = TSymbolInfoAdapter.convert([enumSym]);

      expect(info.enumMembers.get("Priority")?.get("LOW")).toBe(0);
      expect(info.enumMembers.get("Priority")?.get("MEDIUM")).toBe(1);
      expect(info.enumMembers.get("Priority")?.get("HIGH")).toBe(2);
    });
  });

  describe("convert bitmaps", () => {
    it("should populate knownBitmaps set", () => {
      const bitmap: IBitmapSymbol = {
        kind: "bitmap",
        name: "Status",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        backingType: "uint8_t",
        bitWidth: 8,
        fields: new Map([["enabled", { offset: 0, width: 1 }]]),
      };

      const info = TSymbolInfoAdapter.convert([bitmap]);

      expect(info.knownBitmaps.has("Status")).toBe(true);
    });

    it("should populate bitmapBackingType and bitmapBitWidth", () => {
      const bitmap: IBitmapSymbol = {
        kind: "bitmap",
        name: "Control",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        backingType: "uint16_t",
        bitWidth: 16,
        fields: new Map([
          ["mode", { offset: 0, width: 4 }],
          ["channel", { offset: 4, width: 4 }],
          ["reserved", { offset: 8, width: 8 }],
        ]),
      };

      const info = TSymbolInfoAdapter.convert([bitmap]);

      expect(info.bitmapBackingType.get("Control")).toBe("uint16_t");
      expect(info.bitmapBitWidth.get("Control")).toBe(16);
    });

    it("should populate bitmapFields with offset and width", () => {
      const bitmap: IBitmapSymbol = {
        kind: "bitmap",
        name: "Flags",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        backingType: "uint8_t",
        bitWidth: 8,
        fields: new Map([
          ["enabled", { offset: 0, width: 1 }],
          ["mode", { offset: 1, width: 3 }],
          ["reserved", { offset: 4, width: 4 }],
        ]),
      };

      const info = TSymbolInfoAdapter.convert([bitmap]);

      const fields = info.bitmapFields.get("Flags");
      expect(fields?.get("enabled")).toEqual({ offset: 0, width: 1 });
      expect(fields?.get("mode")).toEqual({ offset: 1, width: 3 });
      expect(fields?.get("reserved")).toEqual({ offset: 4, width: 4 });
    });
  });

  describe("convert scopes", () => {
    it("should populate knownScopes set", () => {
      const motorScope = TestScopeUtils.createMockScope("Motor");
      (motorScope.members as string[]).push("init", "run");
      (motorScope.memberVisibility as Map<string, string>).set(
        "init",
        "public",
      );
      (motorScope.memberVisibility as Map<string, string>).set(
        "run",
        "private",
      );

      const info = TSymbolInfoAdapter.convert([motorScope]);

      expect(info.knownScopes.has("Motor")).toBe(true);
    });

    it("should populate scopeMembers with member names", () => {
      const ledScope = TestScopeUtils.createMockScope("LED");
      (ledScope.members as string[]).push("on", "off", "toggle");
      (ledScope.memberVisibility as Map<string, string>).set("on", "public");
      (ledScope.memberVisibility as Map<string, string>).set("off", "public");
      (ledScope.memberVisibility as Map<string, string>).set(
        "toggle",
        "private",
      );

      const info = TSymbolInfoAdapter.convert([ledScope]);

      const members = info.scopeMembers.get("LED");
      expect(members?.has("on")).toBe(true);
      expect(members?.has("off")).toBe(true);
      expect(members?.has("toggle")).toBe(true);
    });

    it("should populate scopeMemberVisibility", () => {
      const timerScope = TestScopeUtils.createMockScope("Timer");
      (timerScope.members as string[]).push("start", "stop", "reset");
      (timerScope.memberVisibility as Map<string, string>).set(
        "start",
        "public",
      );
      (timerScope.memberVisibility as Map<string, string>).set(
        "stop",
        "public",
      );
      (timerScope.memberVisibility as Map<string, string>).set(
        "reset",
        "private",
      );

      const info = TSymbolInfoAdapter.convert([timerScope]);

      const visibility = info.scopeMemberVisibility.get("Timer");
      expect(visibility?.get("start")).toBe("public");
      expect(visibility?.get("stop")).toBe("public");
      expect(visibility?.get("reset")).toBe("private");
    });
  });

  describe("convert registers", () => {
    it("should populate knownRegisters set", () => {
      const register: IRegisterSymbol = {
        kind: "register",
        name: "GPIO",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        baseAddress: "0x40000000",
        members: new Map([
          ["DATA", { offset: "0x00", cType: "u32", access: "rw" }],
        ]),
      };

      const info = TSymbolInfoAdapter.convert([register]);

      expect(info.knownRegisters.has("GPIO")).toBe(true);
    });

    it("should populate registerBaseAddresses", () => {
      const register: IRegisterSymbol = {
        kind: "register",
        name: "UART",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        baseAddress: "0x40001000",
        members: new Map([
          ["TX", { offset: "0x00", cType: "u32", access: "wo" }],
        ]),
      };

      const info = TSymbolInfoAdapter.convert([register]);

      expect(info.registerBaseAddresses.get("UART")).toBe("0x40001000");
    });

    it("should populate register member info maps", () => {
      const register: IRegisterSymbol = {
        kind: "register",
        name: "SPI",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        baseAddress: "0x40002000",
        members: new Map([
          ["DATA", { offset: "0x00", cType: "u32", access: "rw" }],
          ["STATUS", { offset: "0x04", cType: "u8", access: "ro" }],
        ]),
      };

      const info = TSymbolInfoAdapter.convert([register]);

      expect(info.registerMemberAccess.get("SPI_DATA")).toBe("rw");
      expect(info.registerMemberAccess.get("SPI_STATUS")).toBe("ro");
      expect(info.registerMemberOffsets.get("SPI_DATA")).toBe("0x00");
      expect(info.registerMemberOffsets.get("SPI_STATUS")).toBe("0x04");
      expect(info.registerMemberCTypes.get("SPI_DATA")).toBe("uint32_t");
      expect(info.registerMemberCTypes.get("SPI_STATUS")).toBe("uint8_t");
    });

    it("should track bitmap types for register members", () => {
      const bitmap: IBitmapSymbol = {
        kind: "bitmap",
        name: "StatusFlags",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        backingType: "uint8_t",
        bitWidth: 8,
        fields: new Map([["ready", { offset: 0, width: 1 }]]),
      };

      const register: IRegisterSymbol = {
        kind: "register",
        name: "CTRL",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        baseAddress: "0x40003000",
        members: new Map([
          [
            "FLAGS",
            {
              offset: "0x00",
              cType: "StatusFlags",
              access: "rw",
              bitmapType: "StatusFlags",
            },
          ],
        ]),
      };

      // Include bitmap BEFORE register for knownBitmaps to be populated
      const info = TSymbolInfoAdapter.convert([bitmap, register]);

      expect(info.registerMemberTypes.get("CTRL_FLAGS")).toBe("StatusFlags");
    });
  });

  describe("convert variables", () => {
    it("should track private scope const values for inlining", () => {
      // Create a scoped variable with bare name and scope reference
      const motorScope = TestScopeUtils.createMockScope("Motor");
      const variable: IVariableSymbol = {
        kind: "variable",
        name: "MAX_SPEED", // Bare name - adapter computes mangled name
        scope: motorScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: false, // private
        type: TypeResolver.resolve("u32"),
        isConst: true,
        isAtomic: false,
        isArray: false,
        initialValue: "255",
      };

      const info = TSymbolInfoAdapter.convert([variable]);

      // Adapter stores using mangled name (scope + bare name)
      expect(info.scopePrivateConstValues.get("Motor_MAX_SPEED")).toBe("255");
    });

    it("should not track public const values", () => {
      const motorScope = TestScopeUtils.createMockScope("Motor");
      const variable: IVariableSymbol = {
        kind: "variable",
        name: "PUBLIC_CONST", // Bare name - adapter computes mangled name
        scope: motorScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true, // public
        type: TypeResolver.resolve("u32"),
        isConst: true,
        isAtomic: false,
        isArray: false,
        initialValue: "100",
      };

      const info = TSymbolInfoAdapter.convert([variable]);

      expect(info.scopePrivateConstValues.has("Motor_PUBLIC_CONST")).toBe(
        false,
      );
    });

    it("should not track non-const private values", () => {
      const motorScope = TestScopeUtils.createMockScope("Motor");
      const variable: IVariableSymbol = {
        kind: "variable",
        name: "counter", // Bare name - adapter computes mangled name
        scope: motorScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: false,
        type: TypeResolver.resolve("u32"),
        isConst: false, // not const
        isAtomic: false,
        isArray: false,
      };

      const info = TSymbolInfoAdapter.convert([variable]);

      expect(info.scopePrivateConstValues.has("Motor_counter")).toBe(false);
    });

    it("should NOT track private const array values for inlining", () => {
      // Issue #500: Array consts must be emitted, not inlined
      const motorScope = TestScopeUtils.createMockScope("Motor");
      const variable: IVariableSymbol = {
        kind: "variable",
        name: "LOOKUP_TABLE", // Bare name - adapter computes mangled name
        scope: motorScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: false,
        type: TypeResolver.resolve("u16"),
        isConst: true,
        isAtomic: false,
        isArray: true,
        arrayDimensions: [4],
        initialValue: "[10,20,30,40]",
      };

      const info = TSymbolInfoAdapter.convert([variable]);

      // Arrays should NOT be in scopePrivateConstValues
      expect(info.scopePrivateConstValues.has("Motor_LOOKUP_TABLE")).toBe(
        false,
      );
    });

    it("should NOT track private const multi-dimensional array values", () => {
      // Issue #500: Multi-dimensional arrays must also be emitted
      const motorScope = TestScopeUtils.createMockScope("Motor");
      const variable: IVariableSymbol = {
        kind: "variable",
        name: "MATRIX", // Bare name - adapter computes mangled name
        scope: motorScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: false,
        type: TypeResolver.resolve("u8"),
        isConst: true,
        isAtomic: false,
        isArray: true,
        arrayDimensions: [2, 3],
        initialValue: "[[1,2,3],[4,5,6]]",
      };

      const info = TSymbolInfoAdapter.convert([variable]);

      expect(info.scopePrivateConstValues.has("Motor_MATRIX")).toBe(false);
    });
  });

  describe("hasPublicSymbols", () => {
    it("should return true when scope has public members", () => {
      const ledScope = TestScopeUtils.createMockScope("LED");
      (ledScope.members as string[]).push("on");
      (ledScope.memberVisibility as Map<string, string>).set("on", "public");

      const info = TSymbolInfoAdapter.convert([ledScope]);

      expect(info.hasPublicSymbols()).toBe(true);
    });

    it("should return false when all scope members are private", () => {
      const internalScope = TestScopeUtils.createMockScope("Internal");
      (internalScope.members as string[]).push("helper");
      (internalScope.memberVisibility as Map<string, string>).set(
        "helper",
        "private",
      );

      const info = TSymbolInfoAdapter.convert([internalScope]);

      expect(info.hasPublicSymbols()).toBe(false);
    });

    it("should return false when there are no scopes", () => {
      const struct: IStructSymbol = {
        kind: "struct",
        name: "Point",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        fields: new Map([
          [
            "x",
            {
              name: "x",
              type: TypeResolver.resolve("i32"),
              isArray: false,
              isConst: false,
              isAtomic: false,
            },
          ],
        ]),
      };

      const info = TSymbolInfoAdapter.convert([struct]);

      expect(info.hasPublicSymbols()).toBe(false);
    });
  });

  describe("getSingleFunctionForVariable", () => {
    it("should return null when scopeVariableUsage is empty", () => {
      const info = TSymbolInfoAdapter.convert([]);

      expect(info.getSingleFunctionForVariable("Motor", "counter")).toBeNull();
    });

    // Note: scopeVariableUsage requires function body analysis
    // which isn't done by the current collectors
    it("should return null for unknown variables", () => {
      const motorScope = TestScopeUtils.createMockScope("Motor");
      (motorScope.members as string[]).push("counter");
      (motorScope.memberVisibility as Map<string, string>).set(
        "counter",
        "private",
      );

      const info = TSymbolInfoAdapter.convert([motorScope]);

      expect(info.getSingleFunctionForVariable("Motor", "counter")).toBeNull();
    });
  });

  describe("mixed symbols", () => {
    it("should handle array of different symbol types", () => {
      const motorScope = TestScopeUtils.createMockScope("Motor");
      (motorScope.members as string[]).push("init");
      (motorScope.memberVisibility as Map<string, string>).set(
        "init",
        "public",
      );

      const symbols = [
        {
          kind: "struct",
          name: "Point",
          scope: globalScope,
          sourceFile: "test.cnx",
          sourceLine: 1,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: true,
          fields: new Map([
            [
              "x",
              {
                name: "x",
                type: TypeResolver.resolve("i32"),
                isArray: false,
                isConst: false,
                isAtomic: false,
              },
            ],
          ]),
        } as IStructSymbol,
        {
          kind: "enum",
          name: "Color",
          scope: globalScope,
          sourceFile: "test.cnx",
          sourceLine: 5,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: true,
          members: new Map([
            ["Red", 0],
            ["Green", 1],
          ]),
        } as IEnumSymbol,
        motorScope,
        {
          kind: "function",
          name: "main",
          scope: globalScope,
          body: null,
          sourceFile: "test.cnx",
          sourceLine: 15,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: true,
          returnType: TypeResolver.resolve("void"),
          visibility: "public",
          parameters: [],
        } as IFunctionSymbol,
      ];

      const info = TSymbolInfoAdapter.convert(symbols);

      expect(info.knownStructs.has("Point")).toBe(true);
      expect(info.knownEnums.has("Color")).toBe(true);
      expect(info.knownScopes.has("Motor")).toBe(true);
      expect(info.hasPublicSymbols()).toBe(true);
    });
  });
});
