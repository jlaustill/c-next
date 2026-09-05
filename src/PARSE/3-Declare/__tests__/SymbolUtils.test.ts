/**
 * Unit tests for SymbolUtils
 * Tests utility functions for C/C++ symbol collection
 */
import { describe, it, expect } from "vitest";
import SymbolUtils from "../SymbolUtils";

describe("SymbolUtils", () => {
  // ========================================================================
  // parseArrayDimensions
  // ========================================================================

  describe("parseArrayDimensions", () => {
    it("should parse single dimension", () => {
      expect(SymbolUtils.parseArrayDimensions("data[8]")).toEqual([8]);
      expect(SymbolUtils.parseArrayDimensions("buffer[256]")).toEqual([256]);
      expect(SymbolUtils.parseArrayDimensions("[32]")).toEqual([32]);
    });

    it("should parse multiple dimensions", () => {
      expect(SymbolUtils.parseArrayDimensions("matrix[4][4]")).toEqual([4, 4]);
      expect(SymbolUtils.parseArrayDimensions("cube[2][3][4]")).toEqual([
        2, 3, 4,
      ]);
    });

    it("should return empty array for non-array", () => {
      expect(SymbolUtils.parseArrayDimensions("value")).toEqual([]);
      expect(SymbolUtils.parseArrayDimensions("int x")).toEqual([]);
    });

    it("should handle text with other content", () => {
      expect(SymbolUtils.parseArrayDimensions("uint8_t data[10];")).toEqual([
        10,
      ]);
      // Issue #981: macro-sized arrays are captured as strings
      expect(
        SymbolUtils.parseArrayDimensions("char buffer[BUFFER_SIZE]"),
      ).toEqual(["BUFFER_SIZE"]);
    });
  });

  // ========================================================================
  // getTypeWidth
  // ========================================================================

  describe("getTypeWidth", () => {
    describe("stdint.h types", () => {
      it("should return 8 for 8-bit types", () => {
        expect(SymbolUtils.getTypeWidth("uint8_t")).toBe(8);
        expect(SymbolUtils.getTypeWidth("int8_t")).toBe(8);
      });

      it("should return 16 for 16-bit types", () => {
        expect(SymbolUtils.getTypeWidth("uint16_t")).toBe(16);
        expect(SymbolUtils.getTypeWidth("int16_t")).toBe(16);
      });

      it("should return 32 for 32-bit types", () => {
        expect(SymbolUtils.getTypeWidth("uint32_t")).toBe(32);
        expect(SymbolUtils.getTypeWidth("int32_t")).toBe(32);
      });

      it("should return 64 for 64-bit types", () => {
        expect(SymbolUtils.getTypeWidth("uint64_t")).toBe(64);
        expect(SymbolUtils.getTypeWidth("int64_t")).toBe(64);
      });
    });

    describe("standard C types", () => {
      it("should return correct width for char types", () => {
        expect(SymbolUtils.getTypeWidth("char")).toBe(8);
        expect(SymbolUtils.getTypeWidth("signed char")).toBe(8);
        expect(SymbolUtils.getTypeWidth("unsigned char")).toBe(8);
      });

      it("should return correct width for short types", () => {
        expect(SymbolUtils.getTypeWidth("short")).toBe(16);
        expect(SymbolUtils.getTypeWidth("short int")).toBe(16);
        expect(SymbolUtils.getTypeWidth("signed short")).toBe(16);
        expect(SymbolUtils.getTypeWidth("unsigned short")).toBe(16);
      });

      it("should return correct width for int types", () => {
        expect(SymbolUtils.getTypeWidth("int")).toBe(32);
        expect(SymbolUtils.getTypeWidth("signed int")).toBe(32);
        expect(SymbolUtils.getTypeWidth("unsigned")).toBe(32);
        expect(SymbolUtils.getTypeWidth("unsigned int")).toBe(32);
      });

      it("should return correct width for long types", () => {
        expect(SymbolUtils.getTypeWidth("long")).toBe(32);
        expect(SymbolUtils.getTypeWidth("long int")).toBe(32);
        expect(SymbolUtils.getTypeWidth("unsigned long")).toBe(32);
      });

      it("should return correct width for long long types", () => {
        expect(SymbolUtils.getTypeWidth("long long")).toBe(64);
        expect(SymbolUtils.getTypeWidth("long long int")).toBe(64);
        expect(SymbolUtils.getTypeWidth("unsigned long long")).toBe(64);
      });
    });

    describe("unknown types", () => {
      it("should return 0 for unknown types", () => {
        expect(SymbolUtils.getTypeWidth("MyStruct")).toBe(0);
        expect(SymbolUtils.getTypeWidth("float")).toBe(0);
        expect(SymbolUtils.getTypeWidth("double")).toBe(0);
        expect(SymbolUtils.getTypeWidth("void")).toBe(0);
      });
    });
  });

  // ========================================================================
  // Reserved Field Names
  // ADR-058: .length removed, so "length" is no longer reserved
  // ========================================================================

  describe("isReservedFieldName", () => {
    it("should return false for all names (no reserved names after ADR-058)", () => {
      // "length" is no longer reserved since .length was deprecated
      expect(SymbolUtils.isReservedFieldName("length")).toBe(false);
      expect(SymbolUtils.isReservedFieldName("x")).toBe(false);
      expect(SymbolUtils.isReservedFieldName("data")).toBe(false);
      expect(SymbolUtils.isReservedFieldName("size")).toBe(false);
      expect(SymbolUtils.isReservedFieldName("count")).toBe(false);
    });
  });

  describe("getReservedFieldNames", () => {
    it("should return empty array (no reserved names after ADR-058)", () => {
      const reserved = SymbolUtils.getReservedFieldNames();
      expect(Array.isArray(reserved)).toBe(true);
      expect(reserved).toHaveLength(0);
    });
  });

  describe("getReservedFieldWarning", () => {
    it("should generate C warning message", () => {
      const msg = SymbolUtils.getReservedFieldWarning(
        "C",
        "MyStruct",
        "someField",
      );
      expect(msg).toContain("C header struct");
      expect(msg).toContain("MyStruct");
      expect(msg).toContain("someField");
      expect(msg).toContain("conflicts with C-Next");
    });

    it("should generate C++ warning message", () => {
      const msg = SymbolUtils.getReservedFieldWarning(
        "C++",
        "MyClass",
        "someField",
      );
      expect(msg).toContain("C++ header struct");
      expect(msg).toContain("MyClass");
      expect(msg).toContain("someField");
    });
  });
});
