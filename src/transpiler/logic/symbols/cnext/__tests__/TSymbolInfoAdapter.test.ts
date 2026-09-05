/**
 * Unit tests for TSymbolInfoAdapter.
 * Tests conversion from TSymbol[] to ISymbolInfo interface for CodeGenerator.
 *
 * ADR-055 Phase 5: These tests verify that the adapter correctly converts
 * discriminated union symbols into the flat map format expected by CodeGenerator.
 */

import type IBitmapFieldLayout from "../../../../types/IBitmapFieldLayout";
import { describe, expect, it } from "vitest";
import TSymbolInfoAdapter from "../adapters/TSymbolInfoAdapter";
import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import IBitmapSymbol from "../../../../types/symbols/IBitmapSymbol";
import IEnumSymbol from "../../../../types/symbols/IEnumSymbol";
import IStructSymbol from "../../../../types/symbols/IStructSymbol";
import IRegisterSymbol from "../../../../types/symbols/IRegisterSymbol";
import IVariableSymbol from "../../../../types/symbols/IVariableSymbol";
import IFunctionSymbol from "../../../../types/symbols/IFunctionSymbol";
import TypeResolver from "../../../../../utils/TypeResolver";
import TestScopeUtils from "./testUtils";
import TestSymbolUtils from "./testSymbolUtils";
import TestSourceSpan from "../../../../types/__testUtils__/testSourceSpan";
import TestEnumMembers from "../../../../types/__testUtils__/testEnumMembers";
import TestMembers from "../../../../types/__testUtils__/testMembers";

describe("TSymbolInfoAdapter", () => {
  // Reset global scope between tests to avoid state pollution

  describe("convert structs", () => {
    it("should populate knownStructs set", () => {
      const struct: IStructSymbol = {
        ...TestSymbolUtils.base({
          kind: "struct",
          name: "Point",
          scopePath: "",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "public",
        }),
        fields: TestMembers.asStructFields(
          "Point",
          new Map([
            [
              "x",
              {
                name: "x",
                type: TypeResolver.resolve("i32"),
                isArray: false,
                isConst: false,
                isAtomic: false,
                isVolatile: false,
                overflowBehavior: "clamp",
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
                isVolatile: false,
                overflowBehavior: "clamp",
              },
            ],
          ]),
        ),
      };

      const info = TSymbolInfoAdapter.convert([struct]);

      expect(info.knownStructs.has("Point")).toBe(true);
    });

    it("should populate structFields map", () => {
      const struct: IStructSymbol = {
        ...TestSymbolUtils.base({
          kind: "struct",
          name: "Point",
          scopePath: "",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "public",
        }),
        fields: TestMembers.asStructFields(
          "Point",
          new Map([
            [
              "x",
              {
                name: "x",
                type: TypeResolver.resolve("i32"),
                isArray: false,
                isConst: false,
                isAtomic: false,
                isVolatile: false,
                overflowBehavior: "clamp",
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
                isVolatile: false,
                overflowBehavior: "clamp",
              },
            ],
          ]),
        ),
      };

      const info = TSymbolInfoAdapter.convert([struct]);

      expect(info.structFields.get("Point")?.get("x")).toBe("i32");
      expect(info.structFields.get("Point")?.get("y")).toBe("f32");
    });

    it("should populate structFieldArrays for array fields", () => {
      const struct: IStructSymbol = {
        ...TestSymbolUtils.base({
          kind: "struct",
          name: "Buffer",
          scopePath: "",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "public",
        }),
        fields: TestMembers.asStructFields(
          "Buffer",
          new Map([
            [
              "data",
              {
                name: "data",
                type: TypeResolver.resolve("u8"),
                isArray: true,
                isConst: false,
                isAtomic: false,
                isVolatile: false,
                overflowBehavior: "clamp",
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
                isVolatile: false,
                overflowBehavior: "clamp",
              },
            ],
          ]),
        ),
      };

      const info = TSymbolInfoAdapter.convert([struct]);

      expect(info.structFieldArrays.get("Buffer")?.has("data")).toBe(true);
      expect(info.structFieldArrays.get("Buffer")?.has("size")).toBe(false);
    });

    it("should populate structFieldDimensions for array fields", () => {
      const struct: IStructSymbol = {
        ...TestSymbolUtils.base({
          kind: "struct",
          name: "Matrix",
          scopePath: "",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "public",
        }),
        fields: TestMembers.asStructFields(
          "Matrix",
          new Map([
            [
              "values",
              {
                name: "values",
                type: TypeResolver.resolve("f32"),
                isArray: true,
                isConst: false,
                isAtomic: false,
                isVolatile: false,
                overflowBehavior: "clamp",
                dimensions: [4, 4],
              },
            ],
          ]),
        ),
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
        ...TestSymbolUtils.base({
          kind: "enum",
          name: "Color",
          scopePath: "",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "public",
        }),
        members: TestEnumMembers.of("Color", { Red: 0, Green: 1, Blue: 2 }),
      };

      const info = TSymbolInfoAdapter.convert([enumSym]);

      expect(info.knownEnums.has("Color")).toBe(true);
    });

    it("should populate enumMembers map", () => {
      const enumSym: IEnumSymbol = {
        ...TestSymbolUtils.base({
          kind: "enum",
          name: "Priority",
          scopePath: "",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "public",
        }),
        members: TestEnumMembers.of("Priority", { LOW: 0, MEDIUM: 1, HIGH: 2 }),
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
        ...TestSymbolUtils.base({
          kind: "bitmap",
          name: "Status",
          scopePath: "",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "public",
        }),
        backingType: "uint8_t",
        bitWidth: 8,
        fields: TestMembers.asBitmapFields(
          "Status",
          new Map([["enabled", { offset: 0, width: 1 }]]),
        ),
      };

      const info = TSymbolInfoAdapter.convert([bitmap]);

      expect(info.knownBitmaps.has("Status")).toBe(true);
    });

    it("should populate bitmapBackingType and bitmapBitWidth", () => {
      const bitmap: IBitmapSymbol = {
        ...TestSymbolUtils.base({
          kind: "bitmap",
          name: "Control",
          scopePath: "",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "public",
        }),
        backingType: "uint16_t",
        bitWidth: 16,
        fields: TestMembers.asBitmapFields(
          "Control",
          new Map([
            ["mode", { offset: 0, width: 4 }],
            ["channel", { offset: 4, width: 4 }],
            ["reserved", { offset: 8, width: 8 }],
          ]),
        ),
      };

      const info = TSymbolInfoAdapter.convert([bitmap]);

      expect(info.bitmapBackingType.get("Control")).toBe("uint16_t");
      expect(info.bitmapBitWidth.get("Control")).toBe(16);
    });

    it("should populate bitmapFields with offset and width", () => {
      const bitmap: IBitmapSymbol = {
        ...TestSymbolUtils.base({
          kind: "bitmap",
          name: "Flags",
          scopePath: "",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "public",
        }),
        backingType: "uint8_t",
        bitWidth: 8,
        fields: TestMembers.asBitmapFields(
          "Flags",
          new Map([
            ["enabled", { offset: 0, width: 1 }],
            ["mode", { offset: 1, width: 3 }],
            ["reserved", { offset: 4, width: 4 }],
          ]),
        ),
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
        ...TestSymbolUtils.base({
          kind: "register",
          name: "GPIO",
          scopePath: "",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "public",
        }),
        baseAddress: "0x40000000",
        members: TestMembers.asRegisterMembers(
          "GPIO",
          new Map([["DATA", { offset: "0x00", cType: "u32", access: "rw" }]]),
        ),
      };

      const info = TSymbolInfoAdapter.convert([register]);

      expect(info.knownRegisters.has("GPIO")).toBe(true);
    });

    it("should populate registerBaseAddresses", () => {
      const register: IRegisterSymbol = {
        ...TestSymbolUtils.base({
          kind: "register",
          name: "UART",
          scopePath: "",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "public",
        }),
        baseAddress: "0x40001000",
        members: TestMembers.asRegisterMembers(
          "UART",
          new Map([["TX", { offset: "0x00", cType: "u32", access: "wo" }]]),
        ),
      };

      const info = TSymbolInfoAdapter.convert([register]);

      expect(info.registerBaseAddresses.get("UART")).toBe("0x40001000");
    });

    it("should populate register member info maps", () => {
      const register: IRegisterSymbol = {
        ...TestSymbolUtils.base({
          kind: "register",
          name: "SPI",
          scopePath: "",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "public",
        }),
        baseAddress: "0x40002000",
        members: TestMembers.asRegisterMembers(
          "SPI",
          new Map([
            ["DATA", { offset: "0x00", cType: "u32", access: "rw" }],
            ["STATUS", { offset: "0x04", cType: "u8", access: "ro" }],
          ]),
        ),
      };

      const info = TSymbolInfoAdapter.convert([register]);

      expect(info.registerMemberAccess.get("SPI__DATA")).toBe("rw");
      expect(info.registerMemberAccess.get("SPI__STATUS")).toBe("ro");
      expect(info.registerMemberOffsets.get("SPI__DATA")).toBe("0x00");
      expect(info.registerMemberOffsets.get("SPI__STATUS")).toBe("0x04");
      expect(info.registerMemberCTypes.get("SPI__DATA")).toBe("uint32_t");
      expect(info.registerMemberCTypes.get("SPI__STATUS")).toBe("uint8_t");
    });

    it("should track bitmap types for register members", () => {
      const bitmap: IBitmapSymbol = {
        ...TestSymbolUtils.base({
          kind: "bitmap",
          name: "StatusFlags",
          scopePath: "",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "public",
        }),
        backingType: "uint8_t",
        bitWidth: 8,
        fields: TestMembers.asBitmapFields(
          "StatusFlags",
          new Map([["ready", { offset: 0, width: 1 }]]),
        ),
      };

      const register: IRegisterSymbol = {
        ...TestSymbolUtils.base({
          kind: "register",
          name: "CTRL",
          scopePath: "",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "public",
        }),
        baseAddress: "0x40003000",
        members: TestMembers.asRegisterMembers(
          "CTRL",
          new Map([
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
        ),
      };

      // Include bitmap BEFORE register for knownBitmaps to be populated
      const info = TSymbolInfoAdapter.convert([bitmap, register]);

      expect(info.registerMemberTypes.get("CTRL__FLAGS")).toBe("StatusFlags");
    });
  });

  describe("convert variables", () => {
    it("should track private scope const values for inlining", () => {
      // Create a scoped variable with bare name and scope reference
      const variable: IVariableSymbol = {
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "MAX_SPEED", // Bare name - adapter computes transpiled C name,
          scopePath: "Motor",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "private",
        }),
        type: TypeResolver.resolve("u32"),
        isConst: true,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
        isArray: false,
        initialValue: "255",
      };

      const info = TSymbolInfoAdapter.convert([variable]);

      // Adapter stores using transpiled C name (scope + bare name)
      expect(info.scopePrivateConstValues.get("Motor__MAX_SPEED")).toBe("255");
    });

    it("should not track public const values", () => {
      const variable: IVariableSymbol = {
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "PUBLIC_CONST", // Bare name - adapter computes transpiled C name,
          scopePath: "Motor",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "public",
        }),
        type: TypeResolver.resolve("u32"),
        isConst: true,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
        isArray: false,
        initialValue: "100",
      };

      const info = TSymbolInfoAdapter.convert([variable]);

      expect(info.scopePrivateConstValues.has("Motor_PUBLIC_CONST")).toBe(
        false,
      );
    });

    it("should not track non-const private values", () => {
      const variable: IVariableSymbol = {
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "counter", // Bare name - adapter computes transpiled C name,
          scopePath: "Motor",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "private",
        }),
        type: TypeResolver.resolve("u32"),
        isConst: false, // not const
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
        isArray: false,
      };

      const info = TSymbolInfoAdapter.convert([variable]);

      expect(info.scopePrivateConstValues.has("Motor_counter")).toBe(false);
    });

    it("should NOT track private const array values for inlining", () => {
      // Issue #500: Array consts must be emitted, not inlined
      const variable: IVariableSymbol = {
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "LOOKUP_TABLE", // Bare name - adapter computes transpiled C name,
          scopePath: "Motor",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "private",
        }),
        type: TypeResolver.resolve("u16"),
        isConst: true,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
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
      const variable: IVariableSymbol = {
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "MATRIX", // Bare name - adapter computes transpiled C name,
          scopePath: "Motor",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "private",
        }),
        type: TypeResolver.resolve("u8"),
        isConst: true,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
        isArray: true,
        arrayDimensions: [2, 3],
        initialValue: "[[1,2,3],[4,5,6]]",
      };

      const info = TSymbolInfoAdapter.convert([variable]);

      expect(info.scopePrivateConstValues.has("Motor_MATRIX")).toBe(false);
    });

    /**
     * #1398: `processVariable` routes a variable to exactly one of two places,
     * and the value check reads them on different keys -- `knownVariables` by
     * bare name, `scopeMembers` under a scope path. The exclusion is the half
     * most likely to drift, because putting a scoped variable in both sets
     * still passes every fixture: it would only make E0427 more permissive,
     * which no assertion notices until a scoped name leaks bare.
     */
    const makeValue = (name: string, scopePath: string): IVariableSymbol => ({
      ...TestSymbolUtils.base({
        kind: "variable",
        name,
        scopePath,
        sourceFile: "lib.cnx",
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.CNext,
        visibility: "public",
      }),
      type: TypeResolver.resolve("u32"),
      isConst: true,
      isAtomic: false,
      isVolatile: false,
      overflowBehavior: "clamp",
      isArray: false,
      initialValue: "42",
    });

    it("records a file-scope variable in knownVariables (#1398)", () => {
      const info = TSymbolInfoAdapter.convert([makeValue("SHARED_LIMIT", "")]);

      expect(info.knownVariables.has("SHARED_LIMIT")).toBe(true);
    });

    it("keeps a scoped variable OUT of knownVariables, in scopeMembers", () => {
      const info = TSymbolInfoAdapter.convert([
        makeValue("MAX_SPEED", "Motor"),
      ]);

      // Not reachable bare, so it must not answer the bare value lookup...
      expect(info.knownVariables.has("MAX_SPEED")).toBe(false);
      // ...it is reached through the scope path instead.
      expect(info.scopeMembers.get("Motor")?.has("MAX_SPEED")).toBe(true);
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

  describe("mergeOpaqueTypes (Issue #948)", () => {
    it("should return base unchanged when no external opaque types", () => {
      const base = TSymbolInfoAdapter.convert([]);

      const result = TSymbolInfoAdapter.mergeOpaqueTypes(base, []);

      expect(result).toBe(base);
    });

    it("should add external opaque types to opaqueTypes set", () => {
      const base = TSymbolInfoAdapter.convert([]);

      const result = TSymbolInfoAdapter.mergeOpaqueTypes(base, [
        "widget_t",
        "display_t",
      ]);

      expect(result.opaqueTypes.has("widget_t")).toBe(true);
      expect(result.opaqueTypes.has("display_t")).toBe(true);
      expect(result.opaqueTypes.size).toBe(2);
    });

    it("should preserve existing opaque types when merging", () => {
      // Create base with existing opaque type
      const base = TSymbolInfoAdapter.convert([]);
      // Manually create a symbols object with existing opaque types
      const withExisting = TSymbolInfoAdapter.mergeOpaqueTypes(base, [
        "existing_t",
      ]);

      // Merge additional opaque types
      const result = TSymbolInfoAdapter.mergeOpaqueTypes(withExisting, [
        "widget_t",
      ]);

      expect(result.opaqueTypes.has("existing_t")).toBe(true);
      expect(result.opaqueTypes.has("widget_t")).toBe(true);
      expect(result.opaqueTypes.size).toBe(2);
    });

    it("should handle duplicate opaque types gracefully", () => {
      const base = TSymbolInfoAdapter.convert([]);
      const withWidget = TSymbolInfoAdapter.mergeOpaqueTypes(base, [
        "widget_t",
      ]);

      // Try to add the same opaque type again
      const result = TSymbolInfoAdapter.mergeOpaqueTypes(withWidget, [
        "widget_t",
      ]);

      expect(result.opaqueTypes.has("widget_t")).toBe(true);
      expect(result.opaqueTypes.size).toBe(1);
    });

    it("should preserve all other fields unchanged", () => {
      const struct: IStructSymbol = {
        ...TestSymbolUtils.base({
          kind: "struct",
          name: "Point",
          scopePath: "",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "public",
        }),
        fields: TestMembers.asStructFields(
          "Point",
          new Map([
            [
              "x",
              {
                name: "x",
                type: TypeResolver.resolve("i32"),
                isArray: false,
                isConst: false,
                isAtomic: false,
                isVolatile: false,
                overflowBehavior: "clamp",
              },
            ],
          ]),
        ),
      };

      const base = TSymbolInfoAdapter.convert([struct]);
      const result = TSymbolInfoAdapter.mergeOpaqueTypes(base, ["widget_t"]);

      // Verify struct info preserved
      expect(result.knownStructs.has("Point")).toBe(true);
      expect(result.structFields.get("Point")?.get("x")).toBe("i32");

      // Verify opaque type added
      expect(result.opaqueTypes.has("widget_t")).toBe(true);
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
          ...TestSymbolUtils.base({
            kind: "struct",
            name: "Point",
            scopePath: "",
            sourceFile: "test.cnx",
            span: TestSourceSpan.at(1),
            sourceLanguage: ESourceLanguage.CNext,
            visibility: "public",
          }),
          fields: TestMembers.asStructFields(
            "Point",
            new Map([
              [
                "x",
                {
                  name: "x",
                  type: TypeResolver.resolve("i32"),
                  isArray: false,
                  isConst: false,
                  isAtomic: false,
                  isVolatile: false,
                  overflowBehavior: "clamp",
                },
              ],
            ]),
          ),
        } as IStructSymbol,
        {
          ...TestSymbolUtils.base({
            kind: "enum",
            name: "Color",
            scopePath: "",
            sourceFile: "test.cnx",
            span: TestSourceSpan.at(5),
            sourceLanguage: ESourceLanguage.CNext,
            visibility: "public",
          }),
          members: TestEnumMembers.of("Color", { Red: 0, Green: 1 }),
        } as IEnumSymbol,
        motorScope,
        {
          ...TestSymbolUtils.base({
            kind: "function",
            name: "main",
            scopePath: "",
            sourceFile: "test.cnx",
            span: TestSourceSpan.at(15),
            sourceLanguage: ESourceLanguage.CNext,
            visibility: "public",
          }),
          body: null,
          returnType: TypeResolver.resolve("void"),
          visibility: "public",
          parameters: [],
        } as IFunctionSymbol,
      ];

      const info = TSymbolInfoAdapter.convert(symbols);

      expect(info.knownStructs.has("Point")).toBe(true);
      expect(info.knownEnums.has("Color")).toBe(true);
      expect(info.knownScopes.has("Motor")).toBe(true);
    });
  });

  // Issue #1333: a scope may be reopened across files, so an included file's
  // scope types must cross the include boundary. Only knownEnums did -- and
  // enumMembers crossed with it, which is why enums were the only kind that
  // ever worked. A bitmap's NAME alone lets the type resolve and then hard-error
  // on the field lookup behind it.
  //
  // Covered here rather than only in tests/bugs/issue-1333-scope-reopening/
  // because integration fixtures do not feed the coverage metric.
  describe("mergeExternalSymbols — bitmap detail maps", () => {
    const makeBitmap = (
      name: string,
      fields: Map<string, IBitmapFieldLayout> = new Map([
        ["Ready", { offset: 0, width: 1 }],
        ["Mode", { offset: 1, width: 3 }],
      ]),
    ): IBitmapSymbol => ({
      ...TestSymbolUtils.base({
        kind: "bitmap",
        name,
        scopePath: "",
        sourceFile: "lib.cnx",
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.CNext,
        visibility: "public",
      }),
      backingType: "uint8_t",
      bitWidth: 8,
      // #1318: lift at the USE site -- the factory's parameter stays the plain
      // offset/width record its callers pass, so only this line knows fields
      // are symbols now.
      fields: TestMembers.asBitmapFields(name, fields),
    });

    it("carries a bitmap's fields, backing type and bit width across the boundary", () => {
      const base = TSymbolInfoAdapter.convert([]);
      const external = TSymbolInfoAdapter.convert([makeBitmap("Flags")]);

      const merged = TSymbolInfoAdapter.mergeExternalSymbols(base, [external]);

      expect(merged.knownBitmaps.has("Flags")).toBe(true);
      // The name alone is what used to cross; these three are the fix.
      expect(merged.bitmapFields.get("Flags")?.get("Mode")).toEqual({
        offset: 1,
        width: 3,
      });
      expect(merged.bitmapBackingType.get("Flags")).toBe("uint8_t");
      expect(merged.bitmapBitWidth.get("Flags")).toBe(8);
    });

    it("keeps the local definition when both files declare the same bitmap", () => {
      const local = makeBitmap(
        "Flags",
        new Map([["Ready", { offset: 7, width: 1 }]]),
      );

      const base = TSymbolInfoAdapter.convert([local]);
      const external = TSymbolInfoAdapter.convert([makeBitmap("Flags")]);

      const merged = TSymbolInfoAdapter.mergeExternalSymbols(base, [external]);

      // Local takes precedence, matching how enumMembers already merges.
      expect(merged.bitmapFields.get("Flags")?.get("Ready")).toEqual({
        offset: 7,
        width: 1,
      });
      expect(merged.bitmapFields.get("Flags")?.has("Mode")).toBe(false);
    });

    it("returns the base unchanged when there are no external sources", () => {
      const base = TSymbolInfoAdapter.convert([makeBitmap("Flags")]);

      expect(TSymbolInfoAdapter.mergeExternalSymbols(base, [])).toBe(base);
    });
  });

  describe("mergeExternalSymbols — file-scope value names (#1398)", () => {
    const makeFileScopeConst = (name: string): IVariableSymbol => ({
      ...TestSymbolUtils.base({
        kind: "variable",
        name,
        scopePath: "",
        sourceFile: "lib.cnx",
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.CNext,
        visibility: "public",
      }),
      type: TypeResolver.resolve("u32"),
      isConst: true,
      isAtomic: false,
      isVolatile: false,
      overflowBehavior: "clamp",
      isArray: false,
      initialValue: "42",
    });

    /**
     * The value-axis twin of the bitmap test above. #1333 fixed this same
     * asymmetry between two kinds of TYPE in this same function; #1398 is the
     * kind of asymmetry one axis over -- a type declared in an included file
     * crossed and a const beside it did not, so E0426 fired across a file
     * boundary and E0427 could not.
     *
     * Asserted here rather than only through `declared-value-resolves` because
     * the integration control reaches this line by traversal: deleting the
     * `_mergeNames` call reddens a `.cnx` fixture three layers away, and per
     * CLAUDE.md's "presence is not proof", an assertion beside the line is the
     * one that cannot be satisfied by accident.
     */
    it("carries a file-scope value name across the boundary", () => {
      const base = TSymbolInfoAdapter.convert([]);
      const external = TSymbolInfoAdapter.convert([
        makeFileScopeConst("SHARED_LIMIT"),
      ]);

      const merged = TSymbolInfoAdapter.mergeExternalSymbols(base, [external]);

      expect(merged.knownVariables.has("SHARED_LIMIT")).toBe(true);
    });

    it("keeps the local file's own value names when merging", () => {
      const base = TSymbolInfoAdapter.convert([
        makeFileScopeConst("OWN_LIMIT"),
      ]);
      const external = TSymbolInfoAdapter.convert([
        makeFileScopeConst("SHARED_LIMIT"),
      ]);

      const merged = TSymbolInfoAdapter.mergeExternalSymbols(base, [external]);

      expect(merged.knownVariables.has("OWN_LIMIT")).toBe(true);
      expect(merged.knownVariables.has("SHARED_LIMIT")).toBe(true);
    });
  });

  describe("#1301: convert() must not read arrayDimensions", () => {
    /**
     * #1301 shares one declare between transpiler stages 3 and 5, so `convert()`
     * now receives symbols that Stage 3b has already mutated:
     * `SymbolTable.resolveVariableArrayDimensions` casts the readonly view away and
     * REPLACES `arrayDimensions` wholesale, between the cache write and the cache
     * read. Unlike the other mutations of a shared symbol, that one is destructive
     * rather than additive.
     *
     * It is benign only because `convert()` never reads the field. That is a
     * property, not a coincidence to be remembered, so it is asserted here: two
     * symbols differing ONLY in `arrayDimensions` must convert identically. If
     * `convert()` ever starts reading it, this fails and whoever made that change
     * learns that the sharing in #1301 is what their change interacts with.
     */
    it("produces identical output for symbols differing only in arrayDimensions", () => {
      const makeVariable = (
        dimensions: (number | string)[],
      ): IVariableSymbol => ({
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "BUFFER",
          scopePath: "Motor",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.CNext,
          visibility: "public",
        }),
        type: TypeResolver.resolve("u8"),
        isConst: false,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
        isArray: true,
        arrayDimensions: dimensions,
        initialValue: undefined,
      });

      // "BUF_LEN" is the unresolved macro form; [16] is what Stage 3b replaces it
      // with. Both must convert to the same ICodeGenSymbols.
      const unresolved = TSymbolInfoAdapter.convert([
        makeVariable(["BUF_LEN"]),
      ]);
      const resolved = TSymbolInfoAdapter.convert([makeVariable([16])]);

      expect(JSON.stringify(resolved, jsonReplacer)).toBe(
        JSON.stringify(unresolved, jsonReplacer),
      );
    });
  });
});

/** Maps and Sets do not survive JSON.stringify on their own. */
function jsonReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Map) {
    return { __map: [...value.entries()] };
  }
  if (value instanceof Set) {
    return { __set: [...value] };
  }
  return value;
}
