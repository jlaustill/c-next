import { describe, it, expect } from "vitest";
import accessGenerators from "../AccessExprGenerator";
import TTypeInfo from "../../../types/TTypeInfo";

describe("AccessExprGenerator", () => {
  describe("generateCapacityProperty", () => {
    it("returns string capacity for string type", () => {
      const typeInfo: TTypeInfo = {
        baseType: "char",
        bitWidth: 8,
        isArray: false,
        isConst: false,
        isString: true,
        stringCapacity: 64,
      };
      const result = accessGenerators.generateCapacityProperty(typeInfo);
      expect(result.code).toBe("64");
      expect(result.effects).toHaveLength(0);
    });

    it("returns capacity for string with different sizes", () => {
      const typeInfo: TTypeInfo = {
        baseType: "char",
        bitWidth: 8,
        isArray: false,
        isConst: false,
        isString: true,
        stringCapacity: 255,
      };
      const result = accessGenerators.generateCapacityProperty(typeInfo);
      expect(result.code).toBe("255");
    });

    it("throws error for non-string type", () => {
      const typeInfo: TTypeInfo = {
        baseType: "u32",
        bitWidth: 32,
        isArray: false,
        isConst: false,
      };
      expect(() => accessGenerators.generateCapacityProperty(typeInfo)).toThrow(
        "Error: .capacity is only available on string types",
      );
    });

    it("throws error for undefined typeInfo", () => {
      expect(() =>
        accessGenerators.generateCapacityProperty(undefined),
      ).toThrow("Error: .capacity is only available on string types");
    });

    it("throws error for string without capacity defined", () => {
      const typeInfo: TTypeInfo = {
        baseType: "char",
        bitWidth: 8,
        isArray: false,
        isConst: false,
        isString: true,
      };
      expect(() => accessGenerators.generateCapacityProperty(typeInfo)).toThrow(
        "Error: .capacity is only available on string types",
      );
    });
  });

  describe("generateSizeProperty", () => {
    it("returns capacity + 1 for string type", () => {
      const typeInfo: TTypeInfo = {
        baseType: "char",
        bitWidth: 8,
        isArray: false,
        isConst: false,
        isString: true,
        stringCapacity: 64,
      };
      const result = accessGenerators.generateSizeProperty(typeInfo);
      expect(result.code).toBe("65");
      expect(result.effects).toHaveLength(0);
    });

    it("returns correct size for different capacities", () => {
      const typeInfo: TTypeInfo = {
        baseType: "char",
        bitWidth: 8,
        isArray: false,
        isConst: false,
        isString: true,
        stringCapacity: 127,
      };
      const result = accessGenerators.generateSizeProperty(typeInfo);
      expect(result.code).toBe("128");
    });

    it("throws error for non-string type", () => {
      const typeInfo: TTypeInfo = {
        baseType: "i64",
        bitWidth: 64,
        isArray: false,
        isConst: false,
      };
      expect(() => accessGenerators.generateSizeProperty(typeInfo)).toThrow(
        "Error: .size is only available on string types",
      );
    });

    it("throws error for undefined typeInfo", () => {
      expect(() => accessGenerators.generateSizeProperty(undefined)).toThrow(
        "Error: .size is only available on string types",
      );
    });

    it("throws error for string without capacity defined", () => {
      const typeInfo: TTypeInfo = {
        baseType: "char",
        bitWidth: 8,
        isArray: false,
        isConst: false,
        isString: true,
      };
      expect(() => accessGenerators.generateSizeProperty(typeInfo)).toThrow(
        "Error: .size is only available on string types",
      );
    });
  });

  describe("generateBitmapFieldAccess", () => {
    it("generates single bit access", () => {
      const result = accessGenerators.generateBitmapFieldAccess("status", {
        offset: 0,
        width: 1,
      });
      expect(result.code).toBe("((status >> 0) & 1)");
      expect(result.effects).toHaveLength(0);
    });

    it("generates single bit access at different offsets", () => {
      const result = accessGenerators.generateBitmapFieldAccess("flags", {
        offset: 7,
        width: 1,
      });
      expect(result.code).toBe("((flags >> 7) & 1)");
    });

    it("generates multi-bit access with correct mask", () => {
      const result = accessGenerators.generateBitmapFieldAccess("control", {
        offset: 4,
        width: 4,
      });
      // 4-bit mask: (1 << 4) - 1 = 15 = 0xF
      expect(result.code).toBe("((control >> 4) & 0xF)");
    });

    it("generates 2-bit field access", () => {
      const result = accessGenerators.generateBitmapFieldAccess("reg", {
        offset: 2,
        width: 2,
      });
      // 2-bit mask: (1 << 2) - 1 = 3
      expect(result.code).toBe("((reg >> 2) & 0x3)");
    });

    it("generates 8-bit field access", () => {
      const result = accessGenerators.generateBitmapFieldAccess("data", {
        offset: 8,
        width: 8,
      });
      // 8-bit mask: (1 << 8) - 1 = 255 = 0xFF
      expect(result.code).toBe("((data >> 8) & 0xFF)");
    });

    it("handles complex expressions as result", () => {
      const result = accessGenerators.generateBitmapFieldAccess(
        "arr[i].field",
        {
          offset: 0,
          width: 3,
        },
      );
      // 3-bit mask: (1 << 3) - 1 = 7
      expect(result.code).toBe("((arr[i].field >> 0) & 0x7)");
    });

    it("generates 16-bit field access", () => {
      const result = accessGenerators.generateBitmapFieldAccess("word", {
        offset: 0,
        width: 16,
      });
      // 16-bit mask: (1 << 16) - 1 = 65535 = 0xFFFF
      expect(result.code).toBe("((word >> 0) & 0xFFFF)");
    });
  });
});
