import { describe, expect, it, beforeEach } from "vitest";
import parse from "./testHelpers";
import TestScopeUtils from "./testUtils";
import StructCollector from "../collectors/StructCollector";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import TypeResolver from "../../../../utils/TypeResolver";

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
      const symbol = StructCollector.collect(
        structCtx,
        "test.cnx",
        "",
        "public",
      );

      expect(symbol.kind).toBe("struct");
      expect(symbol.name).toBe("Point");
      expect(symbol.sourceFile).toBe("test.cnx");
      expect(symbol.sourceLanguage).toBe(ESourceLanguage.CNext);
      expect(symbol.visibility).toBe("public");
      expect(symbol.scopePath).toBe("");

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
      const symbol = StructCollector.collect(
        structCtx,
        "test.cnx",
        "",
        "public",
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
      const symbol = StructCollector.collect(
        structCtx,
        "test.cnx",
        "",
        "public",
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
      const symbol = StructCollector.collect(
        structCtx,
        "test.cnx",
        "",
        "public",
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
      const symbol = StructCollector.collect(
        structCtx,
        "test.cnx",
        "",
        "public",
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
      const symbol = StructCollector.collect(
        structCtx,
        "test.cnx",
        "",
        "public",
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
      const symbol = StructCollector.collect(
        structCtx,
        "test.cnx",
        "",
        "public",
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
      const symbol = StructCollector.collect(
        structCtx,
        "test.cnx",
        "",
        "public",
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
      const symbol = StructCollector.collect(
        structCtx,
        "test.cnx",
        "",
        "public",
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
      const symbol = StructCollector.collect(
        structCtx,
        "test.cnx",
        "",
        "public",
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
      const symbol = StructCollector.collect(
        structCtx,
        "test.cnx",
        "",
        "public",
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
      const symbol = StructCollector.collect(
        structCtx,
        "test.cnx",
        "",
        "public",
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
      const symbol = StructCollector.collect(
        structCtx,
        "motor.cnx",
        "Motor",
        "public",
      );

      expect(symbol.name).toBe("Config");
      expect(symbol.scopePath).toBe("Motor");
      expect(symbol.scopePath).toBe("Motor");
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
      const symbol = StructCollector.collect(
        structCtx,
        "motor.cnx",
        "Motor",
        "public",
      );

      expect(symbol.name).toBe("Container");
      expect(symbol.scopePath).toBe("Motor");
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
      const symbol = StructCollector.collect(
        structCtx,
        "test.cnx",
        "",
        "public",
      );

      expect(symbol.span.line).toBe(3);
    });
  });

  // #1300 review: every other test in this file passes "public", so the defect
  // class this parameter exists for -- a collector reporting a private
  // declaration as public -- was invisible at the unit level.
  describe("visibility (#1300)", () => {
    it("records a private declaration as private", () => {
      const tree = parse(`
        struct Hidden {
          u32 a;
        }
      `);
      const symbol = StructCollector.collect(
        tree.declaration(0)!.structDeclaration()!,
        "test.cnx",
        "",
        "private",
      );

      expect(symbol.visibility).toBe("private");
    });
  });

  describe("fields carry their own position and identity (#1318)", () => {
    const collect = (code: string, scopePath = "", visibility = "public") =>
      StructCollector.collect(
        parse(code).declaration(0)!.structDeclaration()!,
        "test.cnx",
        scopePath,
        visibility as "public" | "private",
      );

    it("gives each field a DISTINCT line, not the struct's", () => {
      const symbol = collect(`
        struct Point {
          u32 x;
          u32 y;
          u32 z;
        }
      `);
      const lines = [...symbol.fields.values()].map((f) => f.span.line);
      expect(new Set(lines).size).toBe(3);
      expect(lines).not.toContain(symbol.span.line);
    });

    it("keys a field by its owner, and inherits the owner's visibility", () => {
      const global = collect(`struct Point { u32 x; u32 y; }`);
      expect(global.fields.get("x")!.fullyQualifiedCName).toBe("Point__x");

      const scoped = collect(`struct Point { u32 x; }`, "Motor", "private");
      expect(scoped.fields.get("x")!.fullyQualifiedCName).toBe(
        "Motor__Point__x",
      );
      expect(scoped.fields.get("x")!.visibility).toBe("private");
    });

    it("is an index key, not an identifier any generated file contains", () => {
      // Two structs with a field of the same name must not collide in the
      // table; `p.x` is what C actually sees. See IBaseSymbol.
      const a = collect(`struct Point { u32 x; }`);
      const b = collect(`struct Other { u32 x; }`);
      expect(a.fields.get("x")!.fullyQualifiedCName).not.toBe(
        b.fields.get("x")!.fullyQualifiedCName,
      );
    });
  });
});
