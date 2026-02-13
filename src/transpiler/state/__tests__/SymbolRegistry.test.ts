/**
 * Unit tests for SymbolRegistry
 */
import { describe, it, expect, beforeEach } from "vitest";
import SymbolRegistry from "../SymbolRegistry";
import FunctionUtils from "../../types/FunctionUtils";
import TTypeUtils from "../../types/TTypeUtils";

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
});
