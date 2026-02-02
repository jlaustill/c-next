import { describe, it, expect } from "vitest";
import SubscriptClassifier from "../SubscriptClassifier";
import TTypeInfo from "../../types/TTypeInfo";

describe("SubscriptClassifier", () => {
  describe("classify", () => {
    describe("register access", () => {
      it("returns bit_single for single-index register access", () => {
        const result = SubscriptClassifier.classify({
          typeInfo: null,
          subscriptCount: 1,
          isRegisterAccess: true,
        });
        expect(result).toBe("bit_single");
      });

      it("returns bit_range for two-index register access", () => {
        const result = SubscriptClassifier.classify({
          typeInfo: null,
          subscriptCount: 2,
          isRegisterAccess: true,
        });
        expect(result).toBe("bit_range");
      });
    });

    describe("array types", () => {
      it("returns array_element for array type with single index", () => {
        const typeInfo: TTypeInfo = {
          baseType: "u8",
          bitWidth: 8,
          isArray: true,
          isConst: false,
        };
        const result = SubscriptClassifier.classify({
          typeInfo,
          subscriptCount: 1,
          isRegisterAccess: false,
        });
        expect(result).toBe("array_element");
      });

      it("returns array_slice for array type with two indices", () => {
        const typeInfo: TTypeInfo = {
          baseType: "u8",
          bitWidth: 8,
          isArray: true,
          isConst: false,
        };
        const result = SubscriptClassifier.classify({
          typeInfo,
          subscriptCount: 2,
          isRegisterAccess: false,
        });
        expect(result).toBe("array_slice");
      });
    });

    describe("string types", () => {
      it("returns array_element for string type with single index", () => {
        const typeInfo: TTypeInfo = {
          baseType: "string",
          bitWidth: 0,
          isArray: false,
          isConst: false,
          isString: true,
        };
        const result = SubscriptClassifier.classify({
          typeInfo,
          subscriptCount: 1,
          isRegisterAccess: false,
        });
        expect(result).toBe("array_element");
      });
    });

    describe("parameter types (Issue #579)", () => {
      it("returns array_element for non-array parameter with single index", () => {
        const typeInfo: TTypeInfo = {
          baseType: "u8",
          bitWidth: 8,
          isArray: false,
          isConst: false,
          isParameter: true,
        };
        const result = SubscriptClassifier.classify({
          typeInfo,
          subscriptCount: 1,
          isRegisterAccess: false,
        });
        expect(result).toBe("array_element");
      });

      it("returns array_slice for non-array parameter with two indices", () => {
        const typeInfo: TTypeInfo = {
          baseType: "u8",
          bitWidth: 8,
          isArray: false,
          isConst: false,
          isParameter: true,
        };
        const result = SubscriptClassifier.classify({
          typeInfo,
          subscriptCount: 2,
          isRegisterAccess: false,
        });
        expect(result).toBe("array_slice");
      });
    });

    describe("scalar types (bit manipulation)", () => {
      it("returns bit_single for scalar integer with single index", () => {
        const typeInfo: TTypeInfo = {
          baseType: "u8",
          bitWidth: 8,
          isArray: false,
          isConst: false,
        };
        const result = SubscriptClassifier.classify({
          typeInfo,
          subscriptCount: 1,
          isRegisterAccess: false,
        });
        expect(result).toBe("bit_single");
      });

      it("returns bit_range for scalar integer with two indices", () => {
        const typeInfo: TTypeInfo = {
          baseType: "u16",
          bitWidth: 16,
          isArray: false,
          isConst: false,
        };
        const result = SubscriptClassifier.classify({
          typeInfo,
          subscriptCount: 2,
          isRegisterAccess: false,
        });
        expect(result).toBe("bit_range");
      });
    });

    describe("null type info", () => {
      it("returns array_element for null type with single index (safety default)", () => {
        const result = SubscriptClassifier.classify({
          typeInfo: null,
          subscriptCount: 1,
          isRegisterAccess: false,
        });
        expect(result).toBe("array_element");
      });

      it("returns array_slice for null type with two indices (safety default)", () => {
        const result = SubscriptClassifier.classify({
          typeInfo: null,
          subscriptCount: 2,
          isRegisterAccess: false,
        });
        expect(result).toBe("array_slice");
      });
    });
  });

  describe("isArrayAccess", () => {
    it("returns true for null type info (safety default)", () => {
      expect(SubscriptClassifier.isArrayAccess(null)).toBe(true);
    });

    it("returns true for array type", () => {
      const typeInfo: TTypeInfo = {
        baseType: "u8",
        bitWidth: 8,
        isArray: true,
        isConst: false,
      };
      expect(SubscriptClassifier.isArrayAccess(typeInfo)).toBe(true);
    });

    it("returns true for string type", () => {
      const typeInfo: TTypeInfo = {
        baseType: "string",
        bitWidth: 0,
        isArray: false,
        isConst: false,
        isString: true,
      };
      expect(SubscriptClassifier.isArrayAccess(typeInfo)).toBe(true);
    });

    it("returns true for parameter type", () => {
      const typeInfo: TTypeInfo = {
        baseType: "u8",
        bitWidth: 8,
        isArray: false,
        isConst: false,
        isParameter: true,
      };
      expect(SubscriptClassifier.isArrayAccess(typeInfo)).toBe(true);
    });

    it("returns false for scalar non-parameter type", () => {
      const typeInfo: TTypeInfo = {
        baseType: "u8",
        bitWidth: 8,
        isArray: false,
        isConst: false,
      };
      expect(SubscriptClassifier.isArrayAccess(typeInfo)).toBe(false);
    });
  });
});
