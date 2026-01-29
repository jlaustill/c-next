/**
 * Unit tests for TypeRegistrationUtils.
 * Tests the extracted enum/bitmap type registration helpers.
 */

import { describe, expect, it } from "vitest";
import TypeRegistrationUtils from "../TypeRegistrationUtils";
import TTypeInfo from "../types/TTypeInfo";

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
  describe("tryRegisterEnumType", () => {
    it("returns false if type is not a known enum", () => {
      const typeRegistry = new Map<string, TTypeInfo>();
      const symbols = createMockSymbols();

      const result = TypeRegistrationUtils.tryRegisterEnumType(
        typeRegistry,
        symbols,
        "myVar",
        "UnknownType",
        false,
        "clamp",
        false,
      );

      expect(result).toBe(false);
      expect(typeRegistry.size).toBe(0);
    });

    it("registers enum type and returns true", () => {
      const typeRegistry = new Map<string, TTypeInfo>();
      const symbols = createMockSymbols({
        knownEnums: new Set(["MyEnum"]),
      });

      const result = TypeRegistrationUtils.tryRegisterEnumType(
        typeRegistry,
        symbols,
        "myVar",
        "MyEnum",
        false,
        "clamp",
        false,
      );

      expect(result).toBe(true);
      expect(typeRegistry.has("myVar")).toBe(true);

      const info = typeRegistry.get("myVar")!;
      expect(info.baseType).toBe("MyEnum");
      expect(info.isEnum).toBe(true);
      expect(info.enumTypeName).toBe("MyEnum");
      expect(info.isConst).toBe(false);
    });

    it("respects isConst flag", () => {
      const typeRegistry = new Map<string, TTypeInfo>();
      const symbols = createMockSymbols({
        knownEnums: new Set(["MyEnum"]),
      });

      TypeRegistrationUtils.tryRegisterEnumType(
        typeRegistry,
        symbols,
        "myVar",
        "MyEnum",
        true,
        "clamp",
        false,
      );

      expect(typeRegistry.get("myVar")!.isConst).toBe(true);
    });

    it("respects overflowBehavior", () => {
      const typeRegistry = new Map<string, TTypeInfo>();
      const symbols = createMockSymbols({
        knownEnums: new Set(["MyEnum"]),
      });

      TypeRegistrationUtils.tryRegisterEnumType(
        typeRegistry,
        symbols,
        "myVar",
        "MyEnum",
        false,
        "wrap",
        false,
      );

      expect(typeRegistry.get("myVar")!.overflowBehavior).toBe("wrap");
    });

    it("respects isAtomic flag", () => {
      const typeRegistry = new Map<string, TTypeInfo>();
      const symbols = createMockSymbols({
        knownEnums: new Set(["MyEnum"]),
      });

      TypeRegistrationUtils.tryRegisterEnumType(
        typeRegistry,
        symbols,
        "myVar",
        "MyEnum",
        false,
        "clamp",
        true,
      );

      expect(typeRegistry.get("myVar")!.isAtomic).toBe(true);
    });
  });

  describe("tryRegisterBitmapType", () => {
    it("returns false if type is not a known bitmap", () => {
      const typeRegistry = new Map<string, TTypeInfo>();
      const symbols = createMockSymbols();

      const result = TypeRegistrationUtils.tryRegisterBitmapType(
        typeRegistry,
        symbols,
        "myVar",
        "UnknownType",
        false,
        undefined,
        "clamp",
        false,
      );

      expect(result).toBe(false);
      expect(typeRegistry.size).toBe(0);
    });

    it("registers non-array bitmap type", () => {
      const typeRegistry = new Map<string, TTypeInfo>();
      const symbols = createMockSymbols({
        knownBitmaps: new Set(["MyFlags"]),
        bitmapBitWidth: new Map([["MyFlags", 8]]),
      });

      const result = TypeRegistrationUtils.tryRegisterBitmapType(
        typeRegistry,
        symbols,
        "flags",
        "MyFlags",
        false,
        undefined,
        "clamp",
        false,
      );

      expect(result).toBe(true);
      expect(typeRegistry.has("flags")).toBe(true);

      const info = typeRegistry.get("flags")!;
      expect(info.baseType).toBe("MyFlags");
      expect(info.isBitmap).toBe(true);
      expect(info.bitmapTypeName).toBe("MyFlags");
      expect(info.bitWidth).toBe(8);
      expect(info.isArray).toBe(false);
    });

    it("registers bitmap array type with dimensions", () => {
      const typeRegistry = new Map<string, TTypeInfo>();
      const symbols = createMockSymbols({
        knownBitmaps: new Set(["MyFlags"]),
        bitmapBitWidth: new Map([["MyFlags", 16]]),
      });

      const result = TypeRegistrationUtils.tryRegisterBitmapType(
        typeRegistry,
        symbols,
        "flagsArray",
        "MyFlags",
        false,
        [10, 5], // Array dimensions
        "clamp",
        false,
      );

      expect(result).toBe(true);

      const info = typeRegistry.get("flagsArray")!;
      expect(info.isArray).toBe(true);
      expect(info.arrayDimensions).toEqual([10, 5]);
      expect(info.bitWidth).toBe(16);
    });

    it("defaults bitWidth to 0 if not found", () => {
      const typeRegistry = new Map<string, TTypeInfo>();
      const symbols = createMockSymbols({
        knownBitmaps: new Set(["MyFlags"]),
        // No bitWidth entry
      });

      TypeRegistrationUtils.tryRegisterBitmapType(
        typeRegistry,
        symbols,
        "flags",
        "MyFlags",
        false,
        undefined,
        "clamp",
        false,
      );

      expect(typeRegistry.get("flags")!.bitWidth).toBe(0);
    });
  });
});
