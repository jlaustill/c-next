/**
 * Unit tests for TypeRegistrationUtils.
 * Tests the extracted enum/bitmap type registration helpers.
 */

import { beforeEach, describe, expect, it } from "vitest";
import TypeRegistrationUtils from "../TypeRegistrationUtils";
import CodeGenState from "../../../state/CodeGenState";

/**
 * Create mock symbols for testing
 */
function createMockSymbols(overrides: Record<string, unknown> = {}) {
  return {
    knownEnums: new Set<string>(),
    knownBitmaps: new Set<string>(),
    bitmapBitWidth: new Map<string, number>(),
    ...overrides,
  };
}

describe("TypeRegistrationUtils", () => {
  beforeEach(() => {
    CodeGenState.reset();
  });

  describe("tryRegisterEnumType", () => {
    it("returns false if type is not a known enum", () => {
      const symbols = createMockSymbols();

      const result = TypeRegistrationUtils.tryRegisterEnumType(symbols, {
        name: "myVar",
        baseType: "UnknownType",
        isConst: false,
        overflowBehavior: "clamp",
        isAtomic: false,
      });

      expect(result).toBe(false);
      expect(CodeGenState.getVariableTypeInfo("myVar")).toBeUndefined();
    });

    it("registers enum type and returns true", () => {
      const symbols = createMockSymbols({
        knownEnums: new Set(["MyEnum"]),
      });

      const result = TypeRegistrationUtils.tryRegisterEnumType(symbols, {
        name: "myVar",
        baseType: "MyEnum",
        isConst: false,
        overflowBehavior: "clamp",
        isAtomic: false,
      });

      expect(result).toBe(true);
      expect(CodeGenState.hasVariableTypeInfo("myVar")).toBe(true);

      const info = CodeGenState.getVariableTypeInfo("myVar")!;
      expect(info.baseType).toBe("MyEnum");
      expect(info.isEnum).toBe(true);
      expect(info.enumTypeName).toBe("MyEnum");
      expect(info.isConst).toBe(false);
    });

    it("respects isConst flag", () => {
      const symbols = createMockSymbols({
        knownEnums: new Set(["MyEnum"]),
      });

      TypeRegistrationUtils.tryRegisterEnumType(symbols, {
        name: "myVar",
        baseType: "MyEnum",
        isConst: true,
        overflowBehavior: "clamp",
        isAtomic: false,
      });

      expect(CodeGenState.getVariableTypeInfo("myVar")!.isConst).toBe(true);
    });

    it("respects overflowBehavior", () => {
      const symbols = createMockSymbols({
        knownEnums: new Set(["MyEnum"]),
      });

      TypeRegistrationUtils.tryRegisterEnumType(symbols, {
        name: "myVar",
        baseType: "MyEnum",
        isConst: false,
        overflowBehavior: "wrap",
        isAtomic: false,
      });

      expect(CodeGenState.getVariableTypeInfo("myVar")!.overflowBehavior).toBe(
        "wrap",
      );
    });

    it("respects isAtomic flag", () => {
      const symbols = createMockSymbols({
        knownEnums: new Set(["MyEnum"]),
      });

      TypeRegistrationUtils.tryRegisterEnumType(symbols, {
        name: "myVar",
        baseType: "MyEnum",
        isConst: false,
        overflowBehavior: "clamp",
        isAtomic: true,
      });

      expect(CodeGenState.getVariableTypeInfo("myVar")!.isAtomic).toBe(true);
    });
  });

  describe("tryRegisterBitmapType", () => {
    it("returns false if type is not a known bitmap", () => {
      const symbols = createMockSymbols();

      const result = TypeRegistrationUtils.tryRegisterBitmapType(
        symbols,
        {
          name: "myVar",
          baseType: "UnknownType",
          isConst: false,
          overflowBehavior: "clamp",
          isAtomic: false,
        },
        undefined,
      );

      expect(result).toBe(false);
      expect(CodeGenState.getVariableTypeInfo("myVar")).toBeUndefined();
    });

    it("registers non-array bitmap type", () => {
      const symbols = createMockSymbols({
        knownBitmaps: new Set(["MyFlags"]),
        bitmapBitWidth: new Map([["MyFlags", 8]]),
      });

      const result = TypeRegistrationUtils.tryRegisterBitmapType(
        symbols,
        {
          name: "flags",
          baseType: "MyFlags",
          isConst: false,
          overflowBehavior: "clamp",
          isAtomic: false,
        },
        undefined,
      );

      expect(result).toBe(true);
      expect(CodeGenState.hasVariableTypeInfo("flags")).toBe(true);

      const info = CodeGenState.getVariableTypeInfo("flags")!;
      expect(info.baseType).toBe("MyFlags");
      expect(info.isBitmap).toBe(true);
      expect(info.bitmapTypeName).toBe("MyFlags");
      expect(info.bitWidth).toBe(8);
      expect(info.isArray).toBe(false);
    });

    it("registers bitmap array type with dimensions", () => {
      const symbols = createMockSymbols({
        knownBitmaps: new Set(["MyFlags"]),
        bitmapBitWidth: new Map([["MyFlags", 16]]),
      });

      const result = TypeRegistrationUtils.tryRegisterBitmapType(
        symbols,
        {
          name: "flagsArray",
          baseType: "MyFlags",
          isConst: false,
          overflowBehavior: "clamp",
          isAtomic: false,
        },
        [10, 5], // Array dimensions
      );

      expect(result).toBe(true);

      const info = CodeGenState.getVariableTypeInfo("flagsArray")!;
      expect(info.isArray).toBe(true);
      expect(info.arrayDimensions).toEqual([10, 5]);
      expect(info.bitWidth).toBe(16);
    });

    it("defaults bitWidth to 0 if not found", () => {
      const symbols = createMockSymbols({
        knownBitmaps: new Set(["MyFlags"]),
        // No bitWidth entry
      });

      TypeRegistrationUtils.tryRegisterBitmapType(
        symbols,
        {
          name: "flags",
          baseType: "MyFlags",
          isConst: false,
          overflowBehavior: "clamp",
          isAtomic: false,
        },
        undefined,
      );

      expect(CodeGenState.getVariableTypeInfo("flags")!.bitWidth).toBe(0);
    });
  });
});
