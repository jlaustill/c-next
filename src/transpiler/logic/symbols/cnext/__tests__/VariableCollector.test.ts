import { describe, expect, it } from "vitest";
import parse from "./testHelpers";
import TestScopeUtils from "./testUtils";
import VariableCollector from "../collectors/VariableCollector";
import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import TypeResolver from "../../../../types/TypeResolver";

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
        TestScopeUtils.getGlobalScope(),
      );

      expect(symbol.kind).toBe("variable");
      expect(symbol.name).toBe("counter");
      expect(TypeResolver.getTypeName(symbol.type)).toBe("u32");
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
      const symbol = VariableCollector.collect(
        varCtx,
        "test.cnx",
        TestScopeUtils.getGlobalScope(),
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
        TestScopeUtils.getGlobalScope(),
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
        TestScopeUtils.getGlobalScope(),
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
        TestScopeUtils.getGlobalScope(),
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
        TestScopeUtils.getGlobalScope(),
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
        TestScopeUtils.getGlobalScope(),
      );

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
        TestScopeUtils.getGlobalScope(),
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
        TestScopeUtils.getGlobalScope(),
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
        TestScopeUtils.getGlobalScope(),
        true,
        constValues,
      );

      expect(symbol.isArray).toBe(true);
      expect(symbol.arrayDimensions).toEqual([10, 20]);
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
        TestScopeUtils.getGlobalScope(),
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
        TestScopeUtils.getGlobalScope(),
      );

      expect(symbol.isArray).toBe(true);
      expect(symbol.arrayDimensions).toEqual([4, 4]);
    });

    it("collects C-Next style array with const reference dimension", () => {
      const code = `
        u8[SIZE] buffer;
      `;
      const tree = parse(code);
      const varCtx = tree.declaration(0)!.variableDeclaration()!;
      const constValues = new Map<string, number>([["SIZE", 16]]);
      const symbol = VariableCollector.collect(
        varCtx,
        "test.cnx",
        TestScopeUtils.getGlobalScope(),
        true,
        constValues,
      );

      expect(symbol.isArray).toBe(true);
      expect(symbol.arrayDimensions).toEqual([16]);
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
        TestScopeUtils.getGlobalScope(),
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
      const motorScope = TestScopeUtils.createMockScope("Motor");
      const symbol = VariableCollector.collect(varCtx, "motor.cnx", motorScope);

      // With new IScopeSymbol-based design, name is just "position" (not prefixed)
      // The prefixing happens in TSymbolAdapter for backwards compatibility
      expect(symbol.name).toBe("position");
      expect(symbol.scope.name).toBe("Motor");
    });

    it("respects isPublic parameter", () => {
      const code = `
        u32 privateVar;
      `;
      const tree = parse(code);
      const varCtx = tree.declaration(0)!.variableDeclaration()!;
      const motorScope = TestScopeUtils.createMockScope("Motor");
      const symbol = VariableCollector.collect(
        varCtx,
        "motor.cnx",
        motorScope,
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
      const symbol = VariableCollector.collect(
        varCtx,
        "test.cnx",
        TestScopeUtils.getGlobalScope(),
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
        TestScopeUtils.getGlobalScope(),
      );

      expect(symbol.sourceLine).toBe(3);
    });
  });
});
