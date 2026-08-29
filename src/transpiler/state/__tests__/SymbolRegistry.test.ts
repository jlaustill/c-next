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

    // #1358: Declare (pass 1.3) runs over the same tree more than once per run,
    // and reset() runs once per run rather than between them (#1301). An
    // unconditional push appended a second copy of every function in the program.
    it("is idempotent -- re-registering the same declaration does not duplicate it", () => {
      const scope = SymbolRegistry.getOrCreateScope("Test");
      const make = () =>
        FunctionUtils.create({
          name: "fillData",
          scope,
          parameters: [],
          returnType: TTypeUtils.createPrimitive("void"),
          visibility: "private",
          body: null,
          sourceFile: "test.cnx",
          sourceLine: 1,
        });

      // Two DISTINCT objects, as a second resolve of one tree produces.
      // Identity comparison would not catch this; fullyQualifiedCName does.
      const first = make();
      const second = make();
      expect(first).not.toBe(second);

      SymbolRegistry.registerFunction(first);
      SymbolRegistry.registerFunction(second);

      expect(scope.functions).toHaveLength(1);
    });

    // NEGATIVE CONTROL for the assertion above. getOrCreateScope is repeat-safe
    // by design -- that is how a scope spanned across two files merges (#1333).
    // A fix that keyed on the SCOPE rather than the symbol would pass the
    // idempotence test and break this one.
    it("still merges two different functions declared in the same scope from different files", () => {
      const scope = SymbolRegistry.getOrCreateScope("Motor");
      const start = FunctionUtils.create({
        name: "start",
        scope,
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "public",
        body: null,
        sourceFile: "a.cnx",
        sourceLine: 2,
      });
      const stop = FunctionUtils.create({
        name: "stop",
        scope,
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "public",
        body: null,
        sourceFile: "b.cnx",
        sourceLine: 2,
      });

      SymbolRegistry.registerFunction(start);
      SymbolRegistry.registerFunction(stop);

      expect(scope.functions.map((f) => f.name)).toEqual(["start", "stop"]);
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

  describe("findByCName", () => {
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

      const found = SymbolRegistry.findByCName("main");
      expect(found).toBe(func);
    });

    it("finds scoped function by transpiled C name", () => {
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

      const found = SymbolRegistry.findByCName("Test__fillData");
      expect(found).toBe(func);
    });

    it("finds nested scope function by transpiled C name", () => {
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

      const found = SymbolRegistry.findByCName("Outer__Inner__deepFunc");
      expect(found).toBe(func);
    });

    it("returns null for unknown function", () => {
      const found = SymbolRegistry.findByCName("Unknown__func");
      expect(found).toBeNull();
    });
  });

  describe("getScopeByCFunctionName", () => {
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

      const foundScope = SymbolRegistry.getScopeByCFunctionName("Motor__init");
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

      const foundScope = SymbolRegistry.getScopeByCFunctionName("helper");
      expect(foundScope).toBe(global);
    });

    it("returns null for unknown function", () => {
      const foundScope =
        SymbolRegistry.getScopeByCFunctionName("Unknown__func");
      expect(foundScope).toBeNull();
    });
  });
});
