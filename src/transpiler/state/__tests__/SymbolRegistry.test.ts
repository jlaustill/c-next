/**
 * Unit tests for SymbolRegistry
 */
import { describe, it, expect, beforeEach } from "vitest";
import SymbolRegistry from "../SymbolRegistry";
import FunctionUtils from "../../../utils/FunctionUtils";
import TTypeUtils from "../../../utils/TTypeUtils";

describe("SymbolRegistry", () => {
  beforeEach(() => {
    SymbolRegistry.reset();
  });

  describe("getGlobalScope", () => {
    it("returns the global scope singleton", () => {
      const global = SymbolRegistry.getGlobalScope();
      expect(global.kind).toBe("scope");
      expect(global.name).toBe("");
      expect(global.parent).toBe(global);
    });

    it("returns same instance on multiple calls", () => {
      const g1 = SymbolRegistry.getGlobalScope();
      const g2 = SymbolRegistry.getGlobalScope();
      expect(g1).toBe(g2);
    });
  });

  describe("getOrCreateScope", () => {
    it("returns global scope for empty path", () => {
      const scope = SymbolRegistry.getOrCreateScope("");
      expect(scope).toBe(SymbolRegistry.getGlobalScope());
    });

    it("creates scope with global parent for simple name", () => {
      const scope = SymbolRegistry.getOrCreateScope("Test");
      expect(scope.name).toBe("Test");
      expect(scope.parent).toBe(SymbolRegistry.getGlobalScope());
    });

    it("returns same scope for same path", () => {
      const s1 = SymbolRegistry.getOrCreateScope("Test");
      const s2 = SymbolRegistry.getOrCreateScope("Test");
      expect(s1).toBe(s2);
    });

    it("creates nested scopes for dotted path", () => {
      const inner = SymbolRegistry.getOrCreateScope("Outer.Inner");
      expect(inner.name).toBe("Inner");
      expect(inner.parent.name).toBe("Outer");
      expect(inner.parent.parent).toBe(SymbolRegistry.getGlobalScope());
    });
  });

  describe("registerFunction", () => {
    it("adds function to its scope", () => {
      const scope = SymbolRegistry.getOrCreateScope("Test");
      const func = FunctionUtils.create({
        name: "fillData",
        scope,
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "private",
        body: null,
        sourceFile: "test.cnx",
        sourceLine: 1,
      });
      SymbolRegistry.registerFunction(func);

      expect(scope.functions).toContain(func);
    });
  });

  describe("resolveFunction", () => {
    it("finds function in current scope", () => {
      const scope = SymbolRegistry.getOrCreateScope("Test");
      const func = FunctionUtils.create({
        name: "fillData",
        scope,
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "private",
        body: null,
        sourceFile: "test.cnx",
        sourceLine: 1,
      });
      SymbolRegistry.registerFunction(func);

      const found = SymbolRegistry.resolveFunction("fillData", scope);
      expect(found).toBe(func);
    });

    it("finds function in parent scope", () => {
      const global = SymbolRegistry.getGlobalScope();
      const func = FunctionUtils.create({
        name: "helper",
        scope: global,
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "public",
        body: null,
        sourceFile: "test.cnx",
        sourceLine: 1,
      });
      SymbolRegistry.registerFunction(func);

      const childScope = SymbolRegistry.getOrCreateScope("Test");
      const found = SymbolRegistry.resolveFunction("helper", childScope);
      expect(found).toBe(func);
    });

    it("returns null for unknown function", () => {
      const scope = SymbolRegistry.getOrCreateScope("Test");
      const found = SymbolRegistry.resolveFunction("unknown", scope);
      expect(found).toBeNull();
    });
  });

  describe("reset", () => {
    it("clears all registered symbols", () => {
      const scope = SymbolRegistry.getOrCreateScope("Test");
      const func = FunctionUtils.create({
        name: "foo",
        scope,
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "private",
        body: null,
        sourceFile: "test.cnx",
        sourceLine: 1,
      });
      SymbolRegistry.registerFunction(func);

      SymbolRegistry.reset();

      const newGlobal = SymbolRegistry.getGlobalScope();
      expect(newGlobal.functions).toHaveLength(0);

      const found = SymbolRegistry.resolveFunction("foo", newGlobal);
      expect(found).toBeNull();
    });
  });

  describe("findByMangledName", () => {
    it("finds global function by bare name", () => {
      const global = SymbolRegistry.getGlobalScope();
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
      SymbolRegistry.registerFunction(func);

      const found = SymbolRegistry.findByMangledName("main");
      expect(found).toBe(func);
    });

    it("finds scoped function by mangled name", () => {
      const scope = SymbolRegistry.getOrCreateScope("Test");
      const func = FunctionUtils.create({
        name: "fillData",
        scope,
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "private",
        body: null,
        sourceFile: "test.cnx",
        sourceLine: 10,
      });
      SymbolRegistry.registerFunction(func);

      const found = SymbolRegistry.findByMangledName("Test_fillData");
      expect(found).toBe(func);
    });

    it("finds nested scope function by mangled name", () => {
      const scope = SymbolRegistry.getOrCreateScope("Outer.Inner");
      const func = FunctionUtils.create({
        name: "deepFunc",
        scope,
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "private",
        body: null,
        sourceFile: "test.cnx",
        sourceLine: 20,
      });
      SymbolRegistry.registerFunction(func);

      const found = SymbolRegistry.findByMangledName("Outer_Inner_deepFunc");
      expect(found).toBe(func);
    });

    it("returns null for unknown function", () => {
      const found = SymbolRegistry.findByMangledName("Unknown_func");
      expect(found).toBeNull();
    });
  });

  describe("getScopeByMangledFunctionName", () => {
    it("returns scope for scoped function", () => {
      const scope = SymbolRegistry.getOrCreateScope("Motor");
      const func = FunctionUtils.create({
        name: "init",
        scope,
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "public",
        body: null,
        sourceFile: "motor.cnx",
        sourceLine: 5,
      });
      SymbolRegistry.registerFunction(func);

      const foundScope =
        SymbolRegistry.getScopeByMangledFunctionName("Motor_init");
      expect(foundScope).toBe(scope);
    });

    it("returns global scope for global function", () => {
      const global = SymbolRegistry.getGlobalScope();
      const func = FunctionUtils.create({
        name: "helper",
        scope: global,
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "public",
        body: null,
        sourceFile: "helpers.cnx",
        sourceLine: 1,
      });
      SymbolRegistry.registerFunction(func);

      const foundScope = SymbolRegistry.getScopeByMangledFunctionName("helper");
      expect(foundScope).toBe(global);
    });

    it("returns null for unknown function", () => {
      const foundScope =
        SymbolRegistry.getScopeByMangledFunctionName("Unknown_func");
      expect(foundScope).toBeNull();
    });
  });
});
