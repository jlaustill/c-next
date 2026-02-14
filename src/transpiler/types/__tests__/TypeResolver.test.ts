import { describe, it, expect } from "vitest";
import TypeResolver from "../../../utils/TypeResolver";
import type TType from "../TType";

describe("TypeResolver", () => {
  describe("resolve - primitive types", () => {
    it("resolves void", () => {
      const result = TypeResolver.resolve("void");
      expect(result).toEqual({ kind: "primitive", primitive: "void" });
    });

    it("resolves bool", () => {
      const result = TypeResolver.resolve("bool");
      expect(result).toEqual({ kind: "primitive", primitive: "bool" });
    });

    it("resolves u8", () => {
      const result = TypeResolver.resolve("u8");
      expect(result).toEqual({ kind: "primitive", primitive: "u8" });
    });

    it("resolves i8", () => {
      const result = TypeResolver.resolve("i8");
      expect(result).toEqual({ kind: "primitive", primitive: "i8" });
    });

    it("resolves u16", () => {
      const result = TypeResolver.resolve("u16");
      expect(result).toEqual({ kind: "primitive", primitive: "u16" });
    });

    it("resolves i16", () => {
      const result = TypeResolver.resolve("i16");
      expect(result).toEqual({ kind: "primitive", primitive: "i16" });
    });

    it("resolves u32", () => {
      const result = TypeResolver.resolve("u32");
      expect(result).toEqual({ kind: "primitive", primitive: "u32" });
    });

    it("resolves i32", () => {
      const result = TypeResolver.resolve("i32");
      expect(result).toEqual({ kind: "primitive", primitive: "i32" });
    });

    it("resolves u64", () => {
      const result = TypeResolver.resolve("u64");
      expect(result).toEqual({ kind: "primitive", primitive: "u64" });
    });

    it("resolves i64", () => {
      const result = TypeResolver.resolve("i64");
      expect(result).toEqual({ kind: "primitive", primitive: "i64" });
    });

    it("resolves f32", () => {
      const result = TypeResolver.resolve("f32");
      expect(result).toEqual({ kind: "primitive", primitive: "f32" });
    });

    it("resolves f64", () => {
      const result = TypeResolver.resolve("f64");
      expect(result).toEqual({ kind: "primitive", primitive: "f64" });
    });
  });

  describe("resolve - string types", () => {
    it("resolves string<32>", () => {
      const result = TypeResolver.resolve("string<32>");
      expect(result).toEqual({ kind: "string", capacity: 32 });
    });

    it("resolves string<64>", () => {
      const result = TypeResolver.resolve("string<64>");
      expect(result).toEqual({ kind: "string", capacity: 64 });
    });

    it("resolves string<1>", () => {
      const result = TypeResolver.resolve("string<1>");
      expect(result).toEqual({ kind: "string", capacity: 1 });
    });

    it("resolves string<256>", () => {
      const result = TypeResolver.resolve("string<256>");
      expect(result).toEqual({ kind: "string", capacity: 256 });
    });
  });

  describe("resolve - array types", () => {
    it("resolves u8[10]", () => {
      const result = TypeResolver.resolve("u8[10]");
      expect(result).toEqual({
        kind: "array",
        elementType: { kind: "primitive", primitive: "u8" },
        dimensions: [10],
      });
    });

    it("resolves i32[5]", () => {
      const result = TypeResolver.resolve("i32[5]");
      expect(result).toEqual({
        kind: "array",
        elementType: { kind: "primitive", primitive: "i32" },
        dimensions: [5],
      });
    });

    it("resolves f64[100]", () => {
      const result = TypeResolver.resolve("f64[100]");
      expect(result).toEqual({
        kind: "array",
        elementType: { kind: "primitive", primitive: "f64" },
        dimensions: [100],
      });
    });

    it("resolves multi-dimensional array u8[10][20]", () => {
      const result = TypeResolver.resolve("u8[10][20]");
      expect(result).toEqual({
        kind: "array",
        elementType: { kind: "primitive", primitive: "u8" },
        dimensions: [10, 20],
      });
    });

    it("resolves 3D array u32[2][3][4]", () => {
      const result = TypeResolver.resolve("u32[2][3][4]");
      expect(result).toEqual({
        kind: "array",
        elementType: { kind: "primitive", primitive: "u32" },
        dimensions: [2, 3, 4],
      });
    });

    it("resolves array with string dimension (C macro)", () => {
      const result = TypeResolver.resolve("u8[BUFFER_SIZE]");
      expect(result).toEqual({
        kind: "array",
        elementType: { kind: "primitive", primitive: "u8" },
        dimensions: ["BUFFER_SIZE"],
      });
    });

    it("resolves array with mixed dimensions", () => {
      const result = TypeResolver.resolve("u8[10][ROWS]");
      expect(result).toEqual({
        kind: "array",
        elementType: { kind: "primitive", primitive: "u8" },
        dimensions: [10, "ROWS"],
      });
    });

    it("resolves string array string<32>[10]", () => {
      const result = TypeResolver.resolve("string<32>[10]");
      expect(result).toEqual({
        kind: "array",
        elementType: { kind: "string", capacity: 32 },
        dimensions: [10],
      });
    });
  });

  describe("resolve - struct types", () => {
    it("resolves Point as struct", () => {
      const result = TypeResolver.resolve("Point");
      expect(result).toEqual({ kind: "struct", name: "Point" });
    });

    it("resolves Configuration as struct", () => {
      const result = TypeResolver.resolve("Configuration");
      expect(result).toEqual({ kind: "struct", name: "Configuration" });
    });

    it("resolves MyStruct as struct", () => {
      const result = TypeResolver.resolve("MyStruct");
      expect(result).toEqual({ kind: "struct", name: "MyStruct" });
    });
  });

  describe("resolve - enum types", () => {
    it("resolves EColor as enum (E prefix convention)", () => {
      const result = TypeResolver.resolve("EColor");
      expect(result).toEqual({ kind: "enum", name: "EColor" });
    });

    it("resolves EStatus as enum", () => {
      const result = TypeResolver.resolve("EStatus");
      expect(result).toEqual({ kind: "enum", name: "EStatus" });
    });

    it("resolves EPressureType as enum", () => {
      const result = TypeResolver.resolve("EPressureType");
      expect(result).toEqual({ kind: "enum", name: "EPressureType" });
    });
  });

  describe("resolve - external types (C++ templates)", () => {
    it("resolves FlexCAN_T4<CAN1>", () => {
      const result = TypeResolver.resolve("FlexCAN_T4<CAN1>");
      expect(result).toEqual({ kind: "external", name: "FlexCAN_T4<CAN1>" });
    });

    it("resolves std::vector<int>", () => {
      const result = TypeResolver.resolve("std::vector<int>");
      expect(result).toEqual({ kind: "external", name: "std::vector<int>" });
    });

    it("resolves Complex::Namespace::Type<T>", () => {
      const result = TypeResolver.resolve("Complex::Namespace::Type<T>");
      expect(result).toEqual({
        kind: "external",
        name: "Complex::Namespace::Type<T>",
      });
    });
  });

  describe("resolve - struct arrays", () => {
    it("resolves Point[5]", () => {
      const result = TypeResolver.resolve("Point[5]");
      expect(result).toEqual({
        kind: "array",
        elementType: { kind: "struct", name: "Point" },
        dimensions: [5],
      });
    });

    it("resolves Configuration[10][20]", () => {
      const result = TypeResolver.resolve("Configuration[10][20]");
      expect(result).toEqual({
        kind: "array",
        elementType: { kind: "struct", name: "Configuration" },
        dimensions: [10, 20],
      });
    });
  });

  describe("resolve - enum arrays", () => {
    it("resolves EColor[3]", () => {
      const result = TypeResolver.resolve("EColor[3]");
      expect(result).toEqual({
        kind: "array",
        elementType: { kind: "enum", name: "EColor" },
        dimensions: [3],
      });
    });
  });

  describe("resolve - edge cases", () => {
    it("handles whitespace in type string", () => {
      const result = TypeResolver.resolve("  u32  ");
      expect(result).toEqual({ kind: "primitive", primitive: "u32" });
    });

    it("handles whitespace in array dimensions", () => {
      const result = TypeResolver.resolve("u8[ 10 ]");
      expect(result).toEqual({
        kind: "array",
        elementType: { kind: "primitive", primitive: "u8" },
        dimensions: [10],
      });
    });

    it("handles whitespace in string capacity", () => {
      const result = TypeResolver.resolve("string< 32 >");
      expect(result).toEqual({ kind: "string", capacity: 32 });
    });

    it("throws for empty string", () => {
      expect(() => TypeResolver.resolve("")).toThrow(
        "Cannot resolve empty type string",
      );
    });

    it("throws for whitespace-only string", () => {
      expect(() => TypeResolver.resolve("   ")).toThrow(
        "Cannot resolve empty type string",
      );
    });
  });

  describe("getTypeName - round-trip compatibility", () => {
    it("returns primitive name", () => {
      const type: TType = { kind: "primitive", primitive: "u32" };
      expect(TypeResolver.getTypeName(type)).toBe("u32");
    });

    it("returns string with capacity", () => {
      const type: TType = { kind: "string", capacity: 64 };
      expect(TypeResolver.getTypeName(type)).toBe("string<64>");
    });

    it("returns struct name", () => {
      const type: TType = { kind: "struct", name: "Point" };
      expect(TypeResolver.getTypeName(type)).toBe("Point");
    });

    it("returns enum name", () => {
      const type: TType = { kind: "enum", name: "EColor" };
      expect(TypeResolver.getTypeName(type)).toBe("EColor");
    });

    it("returns external name", () => {
      const type: TType = { kind: "external", name: "FlexCAN_T4<CAN1>" };
      expect(TypeResolver.getTypeName(type)).toBe("FlexCAN_T4<CAN1>");
    });

    it("returns array type with dimensions", () => {
      const type: TType = {
        kind: "array",
        elementType: { kind: "primitive", primitive: "u8" },
        dimensions: [10, 20],
      };
      expect(TypeResolver.getTypeName(type)).toBe("u8[10][20]");
    });

    it("returns callback name", () => {
      const type: TType = { kind: "callback", name: "onClick" };
      expect(TypeResolver.getTypeName(type)).toBe("onClick");
    });

    it("returns register name", () => {
      const type: TType = { kind: "register", name: "PORTB" };
      expect(TypeResolver.getTypeName(type)).toBe("PORTB");
    });

    it("returns bitmap name", () => {
      const type: TType = { kind: "bitmap", name: "StatusFlags", bitWidth: 8 };
      expect(TypeResolver.getTypeName(type)).toBe("StatusFlags");
    });
  });
});
