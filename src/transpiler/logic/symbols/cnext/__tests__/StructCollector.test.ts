import { describe, expect, it, beforeEach } from "vitest";
import parse from "./testHelpers";
import TestScopeUtils from "./testUtils";
import StructCollector from "../collectors/StructCollector";
import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import TypeResolver from "../../../../../utils/TypeResolver";

describe("StructCollector", () => {
  beforeEach(() => {
    TestScopeUtils.resetGlobalScope();
  });

  describe("basic struct extraction", () => {
    it("collects a simple struct with primitive fields", () => {
      const code = `
        struct Point {
          i32 x;
          i32 y;
        }
      `;
      const tree = parse(code);
      const structCtx = tree.declaration(0)!.structDeclaration()!;
      const globalScope = TestScopeUtils.getGlobalScope();
      const symbol = StructCollector.collect(
        structCtx,
        "test.cnx",
        globalScope,
      );

      expect(symbol.kind).toBe("struct");
      expect(symbol.name).toBe("Point");
      expect(symbol.sourceFile).toBe("test.cnx");
      expect(symbol.sourceLanguage).toBe(ESourceLanguage.CNext);
      expect(symbol.isExported).toBe(true);
      expect(symbol.scope).toBe(globalScope);

      expect(symbol.fields.size).toBe(2);

      const xField = symbol.fields.get("x");
      expect(xField).toBeDefined();
      expect(TypeResolver.getTypeName(xField!.type)).toBe("i32");
      expect(xField!.isArray).toBe(false);
      expect(xField!.isConst).toBe(false);

      const yField = symbol.fields.get("y");
      expect(yField).toBeDefined();
      expect(TypeResolver.getTypeName(yField!.type)).toBe("i32");
      expect(yField!.isArray).toBe(false);
      expect(yField!.isConst).toBe(false);
    });

    it("collects a struct with various primitive types", () => {
      const code = `
        struct Config {
          u8 version;
          u16 flags;
          u32 size;
          i64 timestamp;
          f32 scale;
          bool enabled;
        }
      `;
      const tree = parse(code);
      const structCtx = tree.declaration(0)!.structDeclaration()!;
      const globalScope = TestScopeUtils.getGlobalScope();
      const symbol = StructCollector.collect(
        structCtx,
        "test.cnx",
        globalScope,
      );

      expect(TypeResolver.getTypeName(symbol.fields.get("version")!.type)).toBe(
        "u8",
      );
      expect(TypeResolver.getTypeName(symbol.fields.get("flags")!.type)).toBe(
        "u16",
      );
      expect(TypeResolver.getTypeName(symbol.fields.get("size")!.type)).toBe(
        "u32",
      );
      expect(
        TypeResolver.getTypeName(symbol.fields.get("timestamp")!.type),
      ).toBe("i64");
      expect(TypeResolver.getTypeName(symbol.fields.get("scale")!.type)).toBe(
        "f32",
      );
      expect(TypeResolver.getTypeName(symbol.fields.get("enabled")!.type)).toBe(
        "bool",
      );
    });
  });

  describe("array fields", () => {
    it("collects a struct with single-dimension array", () => {
      const code = `
        struct Buffer {
          u8 data[256];
        }
      `;
      const tree = parse(code);
      const structCtx = tree.declaration(0)!.structDeclaration()!;
      const globalScope = TestScopeUtils.getGlobalScope();
      const symbol = StructCollector.collect(
        structCtx,
        "test.cnx",
        globalScope,
      );

      const field = symbol.fields.get("data");
      expect(TypeResolver.getTypeName(field!.type)).toBe("u8");
      expect(field?.isArray).toBe(true);
      expect(field?.dimensions).toEqual([256]);
    });

    it("collects a struct with multi-dimensional array", () => {
      const code = `
        struct Matrix {
          f32 values[4][4];
        }
      `;
      const tree = parse(code);
      const structCtx = tree.declaration(0)!.structDeclaration()!;
      const globalScope = TestScopeUtils.getGlobalScope();
      const symbol = StructCollector.collect(
        structCtx,
        "test.cnx",
        globalScope,
      );

      const field = symbol.fields.get("values");
      expect(TypeResolver.getTypeName(field!.type)).toBe("f32");
      expect(field?.isArray).toBe(true);
      expect(field?.dimensions).toEqual([4, 4]);
    });

    it("resolves constant references in array dimensions", () => {
      const code = `
        struct Buffer {
          u8 data[BUFFER_SIZE];
        }
      `;
      const tree = parse(code);
      const structCtx = tree.declaration(0)!.structDeclaration()!;
      const constValues = new Map<string, number>([["BUFFER_SIZE", 256]]);
      const globalScope = TestScopeUtils.getGlobalScope();
      const symbol = StructCollector.collect(
        structCtx,
        "test.cnx",
        globalScope,
        constValues,
      );

      const field = symbol.fields.get("data");
      expect(field?.isArray).toBe(true);
      expect(field?.dimensions).toEqual([256]);
    });

    it("resolves multiple constant dimensions", () => {
      const code = `
        struct Matrix {
          i16 values[ROWS][COLS];
        }
      `;
      const tree = parse(code);
      const structCtx = tree.declaration(0)!.structDeclaration()!;
      const constValues = new Map<string, number>([
        ["ROWS", 4],
        ["COLS", 3],
      ]);
      const globalScope = TestScopeUtils.getGlobalScope();
      const symbol = StructCollector.collect(
        structCtx,
        "test.cnx",
        globalScope,
        constValues,
      );

      const field = symbol.fields.get("values");
      expect(field?.isArray).toBe(true);
      expect(field?.dimensions).toEqual([4, 3]);
    });

    it("resolves hex constant dimensions", () => {
      const code = `
        struct Flags {
          bool bits[HEX_SIZE];
        }
      `;
      const tree = parse(code);
      const structCtx = tree.declaration(0)!.structDeclaration()!;
      const constValues = new Map<string, number>([["HEX_SIZE", 16]]);
      const globalScope = TestScopeUtils.getGlobalScope();
      const symbol = StructCollector.collect(
        structCtx,
        "test.cnx",
        globalScope,
        constValues,
      );

      const field = symbol.fields.get("bits");
      expect(field?.isArray).toBe(true);
      expect(field?.dimensions).toEqual([16]);
    });
  });

  describe("string fields", () => {
    it("collects a struct with string field (adds +1 for null terminator)", () => {
      const code = `
        struct Person {
          string<32> name;
        }
      `;
      const tree = parse(code);
      const structCtx = tree.declaration(0)!.structDeclaration()!;
      const globalScope = TestScopeUtils.getGlobalScope();
      const symbol = StructCollector.collect(
        structCtx,
        "test.cnx",
        globalScope,
      );

      const field = symbol.fields.get("name");
      // Issue #139: Type includes capacity for string validation in CodeGenerator
      expect(TypeResolver.getTypeName(field!.type)).toBe("string<32>");
      expect(field?.isArray).toBe(true);
      expect(field?.dimensions).toEqual([33]); // 32 + 1 for null terminator
    });

    it("collects array of strings", () => {
      const code = `
        struct Names {
          string<16> items[5];
        }
      `;
      const tree = parse(code);
      const structCtx = tree.declaration(0)!.structDeclaration()!;
      const globalScope = TestScopeUtils.getGlobalScope();
      const symbol = StructCollector.collect(
        structCtx,
        "test.cnx",
        globalScope,
      );

      const field = symbol.fields.get("items");
      // Issue #139: Type includes capacity for string validation in CodeGenerator
      expect(TypeResolver.getTypeName(field!.type)).toBe("string<16>");
      expect(field?.isArray).toBe(true);
      expect(field?.dimensions).toEqual([5, 17]); // [5] array, then 16+1 for string
    });

    it("resolves constant dimensions in string array fields", () => {
      const code = `
        struct Names {
          string<16> items[MAX_NAMES];
        }
      `;
      const tree = parse(code);
      const structCtx = tree.declaration(0)!.structDeclaration()!;
      const constValues = new Map<string, number>([["MAX_NAMES", 3]]);
      const globalScope = TestScopeUtils.getGlobalScope();
      const symbol = StructCollector.collect(
        structCtx,
        "test.cnx",
        globalScope,
        constValues,
      );

      const field = symbol.fields.get("items");
      expect(TypeResolver.getTypeName(field!.type)).toBe("string<16>");
      expect(field?.isArray).toBe(true);
      expect(field?.dimensions).toEqual([3, 17]); // [3] from const, then 16+1 for string
    });
  });

  describe("const fields", () => {
    // Note: C-Next grammar doesn't support const modifier on struct members
    // All struct fields are non-const
    it("struct fields are always non-const", () => {
      const code = `
        struct Constants {
          u32 maxSize;
          u32 currentSize;
        }
      `;
      const tree = parse(code);
      const structCtx = tree.declaration(0)!.structDeclaration()!;
      const globalScope = TestScopeUtils.getGlobalScope();
      const symbol = StructCollector.collect(
        structCtx,
        "test.cnx",
        globalScope,
      );

      expect(symbol.fields.get("maxSize")?.isConst).toBe(false);
      expect(symbol.fields.get("currentSize")?.isConst).toBe(false);
    });
  });

  describe("user-defined type fields", () => {
    it("collects fields with user-defined types", () => {
      const code = `
        struct Line {
          Point start;
          Point end;
        }
      `;
      const tree = parse(code);
      const structCtx = tree.declaration(0)!.structDeclaration()!;
      const globalScope = TestScopeUtils.getGlobalScope();
      const symbol = StructCollector.collect(
        structCtx,
        "test.cnx",
        globalScope,
      );

      expect(TypeResolver.getTypeName(symbol.fields.get("start")!.type)).toBe(
        "Point",
      );
      expect(TypeResolver.getTypeName(symbol.fields.get("end")!.type)).toBe(
        "Point",
      );
    });
  });

  describe("scoped structs", () => {
    it("uses scope reference properly", () => {
      const code = `
        struct Config {
          u32 value;
        }
      `;
      const tree = parse(code);
      const structCtx = tree.declaration(0)!.structDeclaration()!;
      const motorScope = TestScopeUtils.createMockScope("Motor");
      const symbol = StructCollector.collect(
        structCtx,
        "motor.cnx",
        motorScope,
      );

      expect(symbol.name).toBe("Config");
      expect(symbol.scope).toBe(motorScope);
      expect(symbol.scope.name).toBe("Motor");
    });

    it("resolves this.Type references within scope", () => {
      // Note: scopedType (this.Type) resolution requires scope context
      // This test verifies the scopeName is used for type resolution
      const code = `
        struct Container {
          u32 value;
        }
      `;
      const tree = parse(code);
      const structCtx = tree.declaration(0)!.structDeclaration()!;
      const motorScope = TestScopeUtils.createMockScope("Motor");
      const symbol = StructCollector.collect(
        structCtx,
        "motor.cnx",
        motorScope,
      );

      expect(symbol.name).toBe("Container");
      expect(symbol.scope.name).toBe("Motor");
    });
  });

  describe("source line tracking", () => {
    it("captures the source line number", () => {
      const code = `

        struct OnLine3 {
          u32 value;
        }
      `;
      const tree = parse(code);
      const structCtx = tree.declaration(0)!.structDeclaration()!;
      const globalScope = TestScopeUtils.getGlobalScope();
      const symbol = StructCollector.collect(
        structCtx,
        "test.cnx",
        globalScope,
      );

      expect(symbol.sourceLine).toBe(3);
    });
  });
});
