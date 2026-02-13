/**
 * Tests for IFunctionSymbol - C-Next function symbol representation
 */
import { describe, it, expect } from "vitest";
import FunctionUtils from "../FunctionUtils";
import ScopeUtils from "../ScopeUtils";
import ParameterUtils from "../ParameterUtils";
import TTypeUtils from "../TTypeUtils";

describe("IFunctionSymbol", () => {
  describe("FunctionUtils.create", () => {
    it("creates function with bare name and scope reference", () => {
      const global = ScopeUtils.createGlobalScope();
      const testScope = ScopeUtils.createScope("Test", global);

      const func = FunctionUtils.create({
        name: "fillData", // Bare name, NOT "Test_fillData"
        scope: testScope,
        parameters: [
          ParameterUtils.create("d", TTypeUtils.createPrimitive("u32"), false),
        ],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "private",
        body: null,
        sourceFile: "test.cnx",
        sourceLine: 10,
      });

      expect(func.kind).toBe("function");
      expect(func.name).toBe("fillData");
      expect(func.scope).toBe(testScope);
      expect(func.parameters).toHaveLength(1);
      expect(func.parameters[0].name).toBe("d");
      expect(func.returnType.kind).toBe("primitive");
      expect(func.visibility).toBe("private");
      expect(func.sourceFile).toBe("test.cnx");
      expect(func.sourceLine).toBe(10);
    });

    it("creates public function in global scope", () => {
      const global = ScopeUtils.createGlobalScope();

      const func = FunctionUtils.create({
        name: "main",
        scope: global,
        parameters: [],
        returnType: TTypeUtils.createPrimitive("i32"),
        visibility: "public",
        body: null,
        sourceFile: "main.cnx",
        sourceLine: 1,
      });

      expect(func.scope).toBe(global);
      expect(func.visibility).toBe("public");
      expect(func.name).toBe("main");
      expect(ScopeUtils.isGlobalScope(func.scope)).toBe(true);
    });

    it("creates function with multiple parameters", () => {
      const global = ScopeUtils.createGlobalScope();

      const func = FunctionUtils.create({
        name: "calculate",
        scope: global,
        parameters: [
          ParameterUtils.create("a", TTypeUtils.createPrimitive("i32"), true),
          ParameterUtils.create("b", TTypeUtils.createPrimitive("i32"), true),
          ParameterUtils.create(
            "result",
            TTypeUtils.createPrimitive("i32"),
            false,
          ),
        ],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "public",
        body: null,
        sourceFile: "calc.cnx",
        sourceLine: 5,
      });

      expect(func.parameters).toHaveLength(3);
      expect(func.parameters[0].isConst).toBe(true);
      expect(func.parameters[1].isConst).toBe(true);
      expect(func.parameters[2].isConst).toBe(false);
    });

    it("creates function with struct return type", () => {
      const global = ScopeUtils.createGlobalScope();

      const func = FunctionUtils.create({
        name: "createPoint",
        scope: global,
        parameters: [
          ParameterUtils.create("x", TTypeUtils.createPrimitive("i32"), false),
          ParameterUtils.create("y", TTypeUtils.createPrimitive("i32"), false),
        ],
        returnType: TTypeUtils.createStruct("Point"),
        visibility: "public",
        body: null,
        sourceFile: "point.cnx",
        sourceLine: 10,
      });

      expect(func.returnType.kind).toBe("struct");
      if (func.returnType.kind === "struct") {
        expect(func.returnType.name).toBe("Point");
      }
    });

    it("creates function with body reference", () => {
      const global = ScopeUtils.createGlobalScope();
      const mockBody = { type: "block", statements: [] };

      const func = FunctionUtils.create({
        name: "doSomething",
        scope: global,
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "public",
        body: mockBody,
        sourceFile: "example.cnx",
        sourceLine: 15,
      });

      expect(func.body).toBe(mockBody);
    });
  });

  describe("FunctionUtils.getCMangledName", () => {
    it("returns bare name for global scope function", () => {
      const global = ScopeUtils.createGlobalScope();

      const func = FunctionUtils.create({
        name: "main",
        scope: global,
        parameters: [],
        returnType: TTypeUtils.createPrimitive("i32"),
        visibility: "public",
        body: null,
        sourceFile: "main.cnx",
        sourceLine: 1,
      });

      expect(FunctionUtils.getCMangledName(func)).toBe("main");
    });

    it("returns scope-prefixed name for scoped function", () => {
      const global = ScopeUtils.createGlobalScope();
      const testScope = ScopeUtils.createScope("Test", global);

      const func = FunctionUtils.create({
        name: "fillData",
        scope: testScope,
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "public",
        body: null,
        sourceFile: "test.cnx",
        sourceLine: 10,
      });

      expect(FunctionUtils.getCMangledName(func)).toBe("Test_fillData");
    });

    it("returns nested scope-prefixed name for nested scope function", () => {
      const global = ScopeUtils.createGlobalScope();
      const outerScope = ScopeUtils.createScope("Outer", global);
      const innerScope = ScopeUtils.createScope("Inner", outerScope);

      const func = FunctionUtils.create({
        name: "process",
        scope: innerScope,
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "public",
        body: null,
        sourceFile: "nested.cnx",
        sourceLine: 20,
      });

      expect(FunctionUtils.getCMangledName(func)).toBe("Outer_Inner_process");
    });
  });

  describe("FunctionUtils.isPublic", () => {
    it("returns true for public function", () => {
      const global = ScopeUtils.createGlobalScope();

      const func = FunctionUtils.create({
        name: "publicFunc",
        scope: global,
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "public",
        body: null,
        sourceFile: "test.cnx",
        sourceLine: 1,
      });

      expect(FunctionUtils.isPublic(func)).toBe(true);
    });

    it("returns false for private function", () => {
      const global = ScopeUtils.createGlobalScope();

      const func = FunctionUtils.create({
        name: "privateFunc",
        scope: global,
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "private",
        body: null,
        sourceFile: "test.cnx",
        sourceLine: 1,
      });

      expect(FunctionUtils.isPublic(func)).toBe(false);
    });
  });

  describe("FunctionUtils.isInGlobalScope", () => {
    it("returns true for function in global scope", () => {
      const global = ScopeUtils.createGlobalScope();

      const func = FunctionUtils.create({
        name: "main",
        scope: global,
        parameters: [],
        returnType: TTypeUtils.createPrimitive("i32"),
        visibility: "public",
        body: null,
        sourceFile: "main.cnx",
        sourceLine: 1,
      });

      expect(FunctionUtils.isInGlobalScope(func)).toBe(true);
    });

    it("returns false for function in named scope", () => {
      const global = ScopeUtils.createGlobalScope();
      const testScope = ScopeUtils.createScope("Test", global);

      const func = FunctionUtils.create({
        name: "helper",
        scope: testScope,
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "private",
        body: null,
        sourceFile: "test.cnx",
        sourceLine: 5,
      });

      expect(FunctionUtils.isInGlobalScope(func)).toBe(false);
    });
  });
});
