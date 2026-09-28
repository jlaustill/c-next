import { describe, expect, it } from "vitest";
import parse from "./testHelpers";
import VariableCollector from "../collectors/VariableCollector";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import TypeResolver from "../../../../utils/TypeResolver";

describe("VariableCollector", () => {
  describe("basic variable extraction", () => {
    it("collects a simple variable declaration", () => {
      const code = `
        u32 counter;
      `;
      const tree = parse(code);
      const varCtx = tree.declaration(0)!.variableDeclaration()!;
      const symbol = VariableCollector.collect(
        varCtx,
        "test.cnx",
        "",
        "public",
      );

      expect(symbol.kind).toBe("variable");
      expect(symbol.name).toBe("counter");
      expect(TypeResolver.getTypeName(symbol.type)).toBe("u32");
      expect(symbol.isConst).toBe(false);
      expect(symbol.isArray).toBe(false);
      expect(symbol.sourceFile).toBe("test.cnx");
      expect(symbol.sourceLanguage).toBe(ESourceLanguage.CNext);
      expect(symbol.visibility).toBe("public");
    });

    it("authors ADR-044 overflow behavior on the symbol (#1303)", () => {
      // #1303: this fact used to be read ONLY in codegen's per-file type
      // registry, so it existed for the declaring file and nowhere else. An
      // imported `u8` reached codegen with nothing to say whether it saturated
      // or wrapped, and plain C arithmetic was emitted -- turning ADR-044's safe
      // default into two's-complement wrap across a file boundary.
      const cases: ReadonlyArray<[string, string, string]> = [
        ["u8 plain;", "plain", "clamp"],
        ["clamp u8 explicitClamp;", "explicitClamp", "clamp"],
        ["wrap u8 explicitWrap;", "explicitWrap", "wrap"],
      ];

      for (const [code, name, expected] of cases) {
        const varCtx = parse(code).declaration(0)!.variableDeclaration()!;
        const symbol = VariableCollector.collect(
          varCtx,
          "test.cnx",
          "",
          "public",
        );

        expect(symbol.name).toBe(name);
        expect(symbol.overflowBehavior).toBe(expected);
      }
    });

    it("collects variables with various primitive types", () => {
      const code = `
        i64 timestamp;
      `;
      const tree = parse(code);
      const varCtx = tree.declaration(0)!.variableDeclaration()!;
      const symbol = VariableCollector.collect(
        varCtx,
        "test.cnx",
        "",
        "public",
      );

      expect(TypeResolver.getTypeName(symbol.type)).toBe("i64");
    });

    it("collects variable with initial value", () => {
      const code = `
        u32 count <- 0;
      `;
      const tree = parse(code);
      const varCtx = tree.declaration(0)!.variableDeclaration()!;
      const symbol = VariableCollector.collect(
        varCtx,
        "test.cnx",
        "",
        "public",
      );

      expect(symbol.initialValue).toBe("0");
    });
  });

  describe("const variables", () => {
    it("detects const modifier", () => {
      const code = `
        const u32 MAX_SIZE <- 1024;
      `;
      const tree = parse(code);
      const varCtx = tree.declaration(0)!.variableDeclaration()!;
      const symbol = VariableCollector.collect(
        varCtx,
        "test.cnx",
        "",
        "public",
      );

      expect(symbol.isConst).toBe(true);
      expect(symbol.initialValue).toBe("1024");
    });

    it("captures hex initial values", () => {
      const code = `
        const u32 MAGIC <- 0xDEADBEEF;
      `;
      const tree = parse(code);
      const varCtx = tree.declaration(0)!.variableDeclaration()!;
      const symbol = VariableCollector.collect(
        varCtx,
        "test.cnx",
        "",
        "public",
      );

      expect(symbol.initialValue).toBe("0xDEADBEEF");
    });
  });

  describe("array variables", () => {
    it("collects single-dimension array", () => {
      const code = `
        u8 buffer[256];
      `;
      const tree = parse(code);
      const varCtx = tree.declaration(0)!.variableDeclaration()!;
      const symbol = VariableCollector.collect(
        varCtx,
        "test.cnx",
        "",
        "public",
      );

      expect(symbol.isArray).toBe(true);
      expect(symbol.arrayDimensions).toEqual([256]);
    });

    it("collects multi-dimensional array", () => {
      const code = `
        f32 matrix[4][4];
      `;
      const tree = parse(code);
      const varCtx = tree.declaration(0)!.variableDeclaration()!;
      const symbol = VariableCollector.collect(
        varCtx,
        "test.cnx",
        "",
        "public",
      );

      expect(symbol.isArray).toBe(true);
      expect(symbol.arrayDimensions).toEqual([4, 4]);
    });

    it("keeps a const-named dimension as text, for 1.4 to fold (#455, #1664 box 7)", () => {
      const code = `
        bool flags[DEVICE_COUNT];
      `;
      const tree = parse(code);
      const varCtx = tree.declaration(0)!.variableDeclaration()!;
      const symbol = VariableCollector.collect(
        varCtx,
        "test.cnx",
        "",
        "public",
      );

      expect(symbol.isArray).toBe(true);
      expect(symbol.arrayDimensions).toEqual(["DEVICE_COUNT"]);
    });

    it("keeps a const-named dimension as text beside a literal (#455)", () => {
      const code = `
        i32 matrix[ROWS][8];
      `;
      const tree = parse(code);
      const varCtx = tree.declaration(0)!.variableDeclaration()!;
      const symbol = VariableCollector.collect(
        varCtx,
        "test.cnx",
        "",
        "public",
      );

      expect(symbol.isArray).toBe(true);
      expect(symbol.arrayDimensions).toEqual(["ROWS", 8]);
    });

    it("keeps several const-named dimensions as text (#455)", () => {
      const code = `
        u16 data[WIDTH][HEIGHT];
      `;
      const tree = parse(code);
      const varCtx = tree.declaration(0)!.variableDeclaration()!;
      const symbol = VariableCollector.collect(
        varCtx,
        "test.cnx",
        "",
        "public",
      );

      expect(symbol.isArray).toBe(true);
      expect(symbol.arrayDimensions).toEqual(["WIDTH", "HEIGHT"]);
    });

    it("collects C-Next style array with dimensions in type (u8[8] arr)", () => {
      const code = `
        u8[8] buffer;
      `;
      const tree = parse(code);
      const varCtx = tree.declaration(0)!.variableDeclaration()!;
      const symbol = VariableCollector.collect(
        varCtx,
        "test.cnx",
        "",
        "public",
      );

      expect(symbol.isArray).toBe(true);
      expect(symbol.arrayDimensions).toEqual([8]);
    });

    it("collects C-Next style multi-dimensional array (u8[4][4] arr)", () => {
      const code = `
        u8[4][4] matrix;
      `;
      const tree = parse(code);
      const varCtx = tree.declaration(0)!.variableDeclaration()!;
      const symbol = VariableCollector.collect(
        varCtx,
        "test.cnx",
        "",
        "public",
      );

      expect(symbol.isArray).toBe(true);
      expect(symbol.arrayDimensions).toEqual([4, 4]);
    });

    it("keeps a const reference in a C-Next style array as text", () => {
      const code = `
        u8[SIZE] buffer;
      `;
      const tree = parse(code);
      const varCtx = tree.declaration(0)!.variableDeclaration()!;
      const symbol = VariableCollector.collect(
        varCtx,
        "test.cnx",
        "",
        "public",
      );

      expect(symbol.isArray).toBe(true);
      expect(symbol.arrayDimensions).toEqual(["SIZE"]);
    });

    it("preserves unresolved macro as string in C-Next style array", () => {
      const code = `
        u8[BUFFER_SIZE] buffer;
      `;
      const tree = parse(code);
      const varCtx = tree.declaration(0)!.variableDeclaration()!;
      const symbol = VariableCollector.collect(
        varCtx,
        "test.cnx",
        "",
        "public",
      );

      expect(symbol.isArray).toBe(true);
      expect(symbol.arrayDimensions).toEqual(["BUFFER_SIZE"]);
    });
  });

  describe("scoped variables", () => {
    it("stores scope reference when scope is provided", () => {
      const code = `
        u32 position;
      `;
      const tree = parse(code);
      const varCtx = tree.declaration(0)!.variableDeclaration()!;
      const symbol = VariableCollector.collect(
        varCtx,
        "motor.cnx",
        "Motor",
        "public",
      );

      // With new IScopeSymbol-based design, name is just "position" (not prefixed)
      // The prefixing happens in TSymbolAdapter for backwards compatibility
      expect(symbol.name).toBe("position");
      expect(symbol.scopePath).toBe("Motor");
    });

    it("respects isPublic parameter", () => {
      const code = `
        u32 privateVar;
      `;
      const tree = parse(code);
      const varCtx = tree.declaration(0)!.variableDeclaration()!;
      const symbol = VariableCollector.collect(
        varCtx,
        "motor.cnx",
        "Motor",
        "private",
      );

      expect(symbol.visibility).toBe("private");
    });
  });

  describe("user-defined types", () => {
    it("handles user-defined types", () => {
      const code = `
        Point origin;
      `;
      const tree = parse(code);
      const varCtx = tree.declaration(0)!.variableDeclaration()!;
      const symbol = VariableCollector.collect(
        varCtx,
        "test.cnx",
        "",
        "public",
      );

      expect(TypeResolver.getTypeName(symbol.type)).toBe("Point");
    });
  });

  describe("source line tracking", () => {
    it("captures the source line number", () => {
      const code = `

        u32 onLine3;
      `;
      const tree = parse(code);
      const varCtx = tree.declaration(0)!.variableDeclaration()!;
      const symbol = VariableCollector.collect(
        varCtx,
        "test.cnx",
        "",
        "public",
      );

      expect(symbol.span.line).toBe(3);
    });
  });

  describe("initializerCallee (#895, #1668)", () => {
    /** What 1.3 records the first local's initializer calling */
    const calleeOf = (body: string) => {
      const declaration = parse(`void f() {\n${body}\n}`)
        .declaration(0)!
        .functionDeclaration()!
        .block()!
        .statement(0)!
        .variableDeclaration()!;
      return VariableCollector.declaredFacts(declaration, "").initializerCallee;
    };

    it.each([
      ["a direct call", "u8 x <- make();", "make"],
      ["a global call", "u8 x <- global.make();", "make"],
      // #1760 review: the call must be the chain's last operation -- what
      // follows it reads INTO the result, so the declaration is not the
      // pointer the call returns
      ["a call with a member after it", "u8 x <- make().v;", null],
      ["a call with a subscript after it", "u8 x <- make()[2];", null],
      [
        "a global call with a subscript after it",
        "u8 x <- global.make()[2];",
        null,
      ],
      ["not a lone call", "u8 x <- make() + 1;", null],
      ["a member's call", "u8 x <- s.make();", null],
      ["a name", "u8 x <- y;", null],
      ["no initializer", "u8 x;", null],
    ])("%s", (_why, body, expected) => {
      expect(calleeOf(body)).toBe(expected);
    });
  });
});
