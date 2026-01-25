import { describe, expect, it } from "vitest";
import parse from "./testHelpers";
import FunctionCollector from "../collectors/FunctionCollector";
import ESymbolKind from "../../../types/ESymbolKind";
import ESourceLanguage from "../../../types/ESourceLanguage";

describe("FunctionCollector", () => {
  describe("basic function extraction", () => {
    it("collects a void function with no parameters", () => {
      const code = `
        void doNothing() {
        }
      `;
      const tree = parse(code);
      const funcCtx = tree.declaration(0)!.functionDeclaration()!;
      const symbol = FunctionCollector.collect(funcCtx, "test.cnx");

      expect(symbol.kind).toBe(ESymbolKind.Function);
      expect(symbol.name).toBe("doNothing");
      expect(symbol.returnType).toBe("void");
      expect(symbol.parameters).toEqual([]);
      expect(symbol.sourceFile).toBe("test.cnx");
      expect(symbol.sourceLanguage).toBe(ESourceLanguage.CNext);
      expect(symbol.visibility).toBe("private");
      expect(symbol.isExported).toBe(false);
    });

    it("collects a function with return type", () => {
      const code = `
        u32 getAnswer() {
          return 42;
        }
      `;
      const tree = parse(code);
      const funcCtx = tree.declaration(0)!.functionDeclaration()!;
      const symbol = FunctionCollector.collect(funcCtx, "test.cnx");

      expect(symbol.returnType).toBe("u32");
    });

    it("collects a function with primitive parameters", () => {
      const code = `
        i32 add(i32 a, i32 b) {
          return a + b;
        }
      `;
      const tree = parse(code);
      const funcCtx = tree.declaration(0)!.functionDeclaration()!;
      const symbol = FunctionCollector.collect(funcCtx, "test.cnx");

      expect(symbol.parameters.length).toBe(2);
      expect(symbol.parameters[0]).toEqual({
        name: "a",
        type: "i32",
        isConst: false,
        isArray: false,
      });
      expect(symbol.parameters[1]).toEqual({
        name: "b",
        type: "i32",
        isConst: false,
        isArray: false,
      });
    });
  });

  describe("parameter modifiers", () => {
    it("detects const parameter modifier", () => {
      const code = `
        void process(const u32 value) {
        }
      `;
      const tree = parse(code);
      const funcCtx = tree.declaration(0)!.functionDeclaration()!;
      const symbol = FunctionCollector.collect(funcCtx, "test.cnx");

      expect(symbol.parameters[0].isConst).toBe(true);
    });

    it("handles array parameters", () => {
      const code = `
        void processArray(u8 data[]) {
        }
      `;
      const tree = parse(code);
      const funcCtx = tree.declaration(0)!.functionDeclaration()!;
      const symbol = FunctionCollector.collect(funcCtx, "test.cnx");

      expect(symbol.parameters[0].isArray).toBe(true);
      expect(symbol.parameters[0].arrayDimensions).toEqual([""]);
    });

    it("handles sized array parameters", () => {
      const code = `
        void processBuffer(u8 buffer[256]) {
        }
      `;
      const tree = parse(code);
      const funcCtx = tree.declaration(0)!.functionDeclaration()!;
      const symbol = FunctionCollector.collect(funcCtx, "test.cnx");

      expect(symbol.parameters[0].isArray).toBe(true);
      expect(symbol.parameters[0].arrayDimensions).toEqual(["256"]);
    });

    it("handles multi-dimensional array parameters", () => {
      const code = `
        void processMatrix(f32 matrix[4][4]) {
        }
      `;
      const tree = parse(code);
      const funcCtx = tree.declaration(0)!.functionDeclaration()!;
      const symbol = FunctionCollector.collect(funcCtx, "test.cnx");

      expect(symbol.parameters[0].isArray).toBe(true);
      expect(symbol.parameters[0].arrayDimensions).toEqual(["4", "4"]);
    });
  });

  describe("signature generation", () => {
    it("generates signature for overload detection", () => {
      const code = `
        i32 calculate(u32 x, f32 y) {
          return 0;
        }
      `;
      const tree = parse(code);
      const funcCtx = tree.declaration(0)!.functionDeclaration()!;
      const symbol = FunctionCollector.collect(funcCtx, "test.cnx");

      expect(symbol.signature).toBe("i32 calculate(u32, f32)");
    });

    it("includes scope prefix in signature", () => {
      const code = `
        void init() {
        }
      `;
      const tree = parse(code);
      const funcCtx = tree.declaration(0)!.functionDeclaration()!;
      const symbol = FunctionCollector.collect(funcCtx, "test.cnx", "Motor");

      expect(symbol.signature).toBe("void Motor_init()");
    });
  });

  describe("scoped functions", () => {
    it("prefixes name with scope when scopeName is provided", () => {
      const code = `
        void update() {
        }
      `;
      const tree = parse(code);
      const funcCtx = tree.declaration(0)!.functionDeclaration()!;
      const symbol = FunctionCollector.collect(funcCtx, "motor.cnx", "Motor");

      expect(symbol.name).toBe("Motor_update");
    });

    it("respects visibility parameter", () => {
      const code = `
        void publicFunc() {
        }
      `;
      const tree = parse(code);
      const funcCtx = tree.declaration(0)!.functionDeclaration()!;
      const symbol = FunctionCollector.collect(
        funcCtx,
        "motor.cnx",
        "Motor",
        "public",
      );

      expect(symbol.visibility).toBe("public");
      expect(symbol.isExported).toBe(true);
    });

    it("marks private functions as not exported", () => {
      const code = `
        void privateFunc() {
        }
      `;
      const tree = parse(code);
      const funcCtx = tree.declaration(0)!.functionDeclaration()!;
      const symbol = FunctionCollector.collect(
        funcCtx,
        "motor.cnx",
        "Motor",
        "private",
      );

      expect(symbol.visibility).toBe("private");
      expect(symbol.isExported).toBe(false);
    });
  });

  describe("user-defined types", () => {
    it("handles user-defined return types", () => {
      const code = `
        Point getOrigin() {
          Point p <- {x: 0, y: 0};
          return p;
        }
      `;
      const tree = parse(code);
      const funcCtx = tree.declaration(0)!.functionDeclaration()!;
      const symbol = FunctionCollector.collect(funcCtx, "test.cnx");

      expect(symbol.returnType).toBe("Point");
    });

    it("handles user-defined parameter types", () => {
      const code = `
        f32 distance(Point from, Point to) {
          return 0.0;
        }
      `;
      const tree = parse(code);
      const funcCtx = tree.declaration(0)!.functionDeclaration()!;
      const symbol = FunctionCollector.collect(funcCtx, "test.cnx");

      expect(symbol.parameters[0].type).toBe("Point");
      expect(symbol.parameters[1].type).toBe("Point");
    });
  });

  describe("source line tracking", () => {
    it("captures the source line number", () => {
      const code = `

        void onLine3() {
        }
      `;
      const tree = parse(code);
      const funcCtx = tree.declaration(0)!.functionDeclaration()!;
      const symbol = FunctionCollector.collect(funcCtx, "test.cnx");

      expect(symbol.sourceLine).toBe(3);
    });
  });
});
