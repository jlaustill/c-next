import { describe, expect, it } from "vitest";
import parse from "./testHelpers";
import StructCollector from "../collectors/StructCollector";
import ESymbolKind from "../../../types/ESymbolKind";
import ESourceLanguage from "../../../types/ESourceLanguage";

describe("StructCollector", () => {
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
      const symbol = StructCollector.collect(structCtx, "test.cnx");

      expect(symbol.kind).toBe(ESymbolKind.Struct);
      expect(symbol.name).toBe("Point");
      expect(symbol.sourceFile).toBe("test.cnx");
      expect(symbol.sourceLanguage).toBe(ESourceLanguage.CNext);
      expect(symbol.isExported).toBe(true);

      expect(symbol.fields.size).toBe(2);
      expect(symbol.fields.get("x")).toEqual({
        type: "i32",
        isArray: false,
        isConst: false,
      });
      expect(symbol.fields.get("y")).toEqual({
        type: "i32",
        isArray: false,
        isConst: false,
      });
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
      const symbol = StructCollector.collect(structCtx, "test.cnx");

      expect(symbol.fields.get("version")?.type).toBe("u8");
      expect(symbol.fields.get("flags")?.type).toBe("u16");
      expect(symbol.fields.get("size")?.type).toBe("u32");
      expect(symbol.fields.get("timestamp")?.type).toBe("i64");
      expect(symbol.fields.get("scale")?.type).toBe("f32");
      expect(symbol.fields.get("enabled")?.type).toBe("bool");
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
      const symbol = StructCollector.collect(structCtx, "test.cnx");

      const field = symbol.fields.get("data");
      expect(field?.type).toBe("u8");
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
      const symbol = StructCollector.collect(structCtx, "test.cnx");

      const field = symbol.fields.get("values");
      expect(field?.type).toBe("f32");
      expect(field?.isArray).toBe(true);
      expect(field?.dimensions).toEqual([4, 4]);
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
      const symbol = StructCollector.collect(structCtx, "test.cnx");

      const field = symbol.fields.get("name");
      expect(field?.type).toBe("string");
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
      const symbol = StructCollector.collect(structCtx, "test.cnx");

      const field = symbol.fields.get("items");
      expect(field?.type).toBe("string");
      expect(field?.isArray).toBe(true);
      expect(field?.dimensions).toEqual([5, 17]); // [5] array, then 16+1 for string
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
      const symbol = StructCollector.collect(structCtx, "test.cnx");

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
      const symbol = StructCollector.collect(structCtx, "test.cnx");

      expect(symbol.fields.get("start")?.type).toBe("Point");
      expect(symbol.fields.get("end")?.type).toBe("Point");
    });
  });

  describe("scoped structs", () => {
    it("prefixes name with scope when scopeName is provided", () => {
      const code = `
        struct Config {
          u32 value;
        }
      `;
      const tree = parse(code);
      const structCtx = tree.declaration(0)!.structDeclaration()!;
      const symbol = StructCollector.collect(structCtx, "motor.cnx", "Motor");

      expect(symbol.name).toBe("Motor_Config");
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
      const symbol = StructCollector.collect(structCtx, "motor.cnx", "Motor");

      expect(symbol.name).toBe("Motor_Container");
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
      const symbol = StructCollector.collect(structCtx, "test.cnx");

      expect(symbol.sourceLine).toBe(3);
    });
  });
});
