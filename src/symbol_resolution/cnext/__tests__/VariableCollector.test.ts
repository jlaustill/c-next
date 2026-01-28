import { describe, expect, it } from "vitest";
import parse from "./testHelpers";
import VariableCollector from "../collectors/VariableCollector";
import ESymbolKind from "../../../types/ESymbolKind";
import ESourceLanguage from "../../../types/ESourceLanguage";

describe("VariableCollector", () => {
  describe("basic variable extraction", () => {
    it("collects a simple variable declaration", () => {
      const code = `
        u32 counter;
      `;
      const tree = parse(code);
      const varCtx = tree.declaration(0)!.variableDeclaration()!;
      const symbol = VariableCollector.collect(varCtx, "test.cnx");

      expect(symbol.kind).toBe(ESymbolKind.Variable);
      expect(symbol.name).toBe("counter");
      expect(symbol.type).toBe("u32");
      expect(symbol.isConst).toBe(false);
      expect(symbol.isArray).toBe(false);
      expect(symbol.sourceFile).toBe("test.cnx");
      expect(symbol.sourceLanguage).toBe(ESourceLanguage.CNext);
      expect(symbol.isExported).toBe(true);
    });

    it("collects variables with various primitive types", () => {
      const code = `
        i64 timestamp;
      `;
      const tree = parse(code);
      const varCtx = tree.declaration(0)!.variableDeclaration()!;
      const symbol = VariableCollector.collect(varCtx, "test.cnx");

      expect(symbol.type).toBe("i64");
    });

    it("collects variable with initial value", () => {
      const code = `
        u32 count <- 0;
      `;
      const tree = parse(code);
      const varCtx = tree.declaration(0)!.variableDeclaration()!;
      const symbol = VariableCollector.collect(varCtx, "test.cnx");

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
      const symbol = VariableCollector.collect(varCtx, "test.cnx");

      expect(symbol.isConst).toBe(true);
      expect(symbol.initialValue).toBe("1024");
    });

    it("captures hex initial values", () => {
      const code = `
        const u32 MAGIC <- 0xDEADBEEF;
      `;
      const tree = parse(code);
      const varCtx = tree.declaration(0)!.variableDeclaration()!;
      const symbol = VariableCollector.collect(varCtx, "test.cnx");

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
      const symbol = VariableCollector.collect(varCtx, "test.cnx");

      expect(symbol.isArray).toBe(true);
      expect(symbol.arrayDimensions).toEqual([256]);
    });

    it("collects multi-dimensional array", () => {
      const code = `
        f32 matrix[4][4];
      `;
      const tree = parse(code);
      const varCtx = tree.declaration(0)!.variableDeclaration()!;
      const symbol = VariableCollector.collect(varCtx, "test.cnx");

      expect(symbol.isArray).toBe(true);
      expect(symbol.arrayDimensions).toEqual([4, 4]);
    });

    it("resolves constant references in array dimensions (issue #455)", () => {
      const code = `
        bool flags[DEVICE_COUNT];
      `;
      const tree = parse(code);
      const varCtx = tree.declaration(0)!.variableDeclaration()!;
      const constValues = new Map<string, number>([["DEVICE_COUNT", 4]]);
      const symbol = VariableCollector.collect(
        varCtx,
        "test.cnx",
        undefined,
        true,
        constValues,
      );

      expect(symbol.isArray).toBe(true);
      expect(symbol.arrayDimensions).toEqual([4]);
    });

    it("resolves mixed literal and constant dimensions (issue #455)", () => {
      const code = `
        i32 matrix[ROWS][8];
      `;
      const tree = parse(code);
      const varCtx = tree.declaration(0)!.variableDeclaration()!;
      const constValues = new Map<string, number>([["ROWS", 4]]);
      const symbol = VariableCollector.collect(
        varCtx,
        "test.cnx",
        undefined,
        true,
        constValues,
      );

      expect(symbol.isArray).toBe(true);
      expect(symbol.arrayDimensions).toEqual([4, 8]);
    });

    it("resolves multiple constant dimensions (issue #455)", () => {
      const code = `
        u16 data[WIDTH][HEIGHT];
      `;
      const tree = parse(code);
      const varCtx = tree.declaration(0)!.variableDeclaration()!;
      const constValues = new Map<string, number>([
        ["WIDTH", 10],
        ["HEIGHT", 20],
      ]);
      const symbol = VariableCollector.collect(
        varCtx,
        "test.cnx",
        undefined,
        true,
        constValues,
      );

      expect(symbol.isArray).toBe(true);
      expect(symbol.arrayDimensions).toEqual([10, 20]);
    });
  });

  describe("scoped variables", () => {
    it("prefixes name with scope when scopeName is provided", () => {
      const code = `
        u32 position;
      `;
      const tree = parse(code);
      const varCtx = tree.declaration(0)!.variableDeclaration()!;
      const symbol = VariableCollector.collect(varCtx, "motor.cnx", "Motor");

      expect(symbol.name).toBe("Motor_position");
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
        false,
      );

      expect(symbol.isExported).toBe(false);
    });
  });

  describe("user-defined types", () => {
    it("handles user-defined types", () => {
      const code = `
        Point origin;
      `;
      const tree = parse(code);
      const varCtx = tree.declaration(0)!.variableDeclaration()!;
      const symbol = VariableCollector.collect(varCtx, "test.cnx");

      expect(symbol.type).toBe("Point");
    });
  });

  describe("source line tracking", () => {
    it("captures the source line number", () => {
      const code = `

        u32 onLine3;
      `;
      const tree = parse(code);
      const varCtx = tree.declaration(0)!.variableDeclaration()!;
      const symbol = VariableCollector.collect(varCtx, "test.cnx");

      expect(symbol.sourceLine).toBe(3);
    });
  });
});
