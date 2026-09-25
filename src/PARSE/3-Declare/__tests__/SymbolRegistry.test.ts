/**
 * Unit tests for SymbolRegistry
 */
import { describe, it, expect, beforeEach } from "vitest";
import SymbolRegistry from "../SymbolRegistry";
import FunctionUtils from "../../../tests/utils/FunctionUtils";
import TTypeUtils from "../../../utils/TTypeUtils";
import TestSourceSpan from "../../../transpiler/types/__testUtils__/testSourceSpan";

let registry = new SymbolRegistry();

beforeEach(() => {
  registry = new SymbolRegistry();
});

describe("SymbolRegistry", () => {
  describe("getGlobalScope", () => {
    it("returns the global scope singleton", () => {
      const global = registry.getGlobalScope();
      expect(global.kind).toBe("scope");
      expect(global.name).toBe("");
      // #1298: no self-reference. The global scope states where it sits with an
      // empty path, which is what makes the symbol graph acyclic.
      expect(global.scopePath).toBe("");
    });

    it("returns same instance on multiple calls", () => {
      const g1 = registry.getGlobalScope();
      const g2 = registry.getGlobalScope();
      expect(g1).toBe(g2);
    });
  });

  describe("getOrCreateScope", () => {
    it("returns global scope for empty path", () => {
      const scope = registry.getOrCreateScope("");
      expect(scope).toBe(registry.getGlobalScope());
    });

    it("creates scope with global parent for simple name", () => {
      const scope = registry.getOrCreateScope("Test");
      expect(scope.name).toBe("Test");
      expect(scope.scopePath).toBe("");
    });

    it("returns same scope for same path", () => {
      const s1 = registry.getOrCreateScope("Test");
      const s2 = registry.getOrCreateScope("Test");
      expect(s1).toBe(s2);
    });

    it("creates nested scopes for dotted path", () => {
      const inner = registry.getOrCreateScope("Outer.Inner");
      expect(inner.name).toBe("Inner");
      expect(inner.scopePath).toBe("Outer");
      // The intermediate scope is still created eagerly, so members can be
      // registered into it -- a child names it by path rather than pointing at it.
      expect(registry.getScope("Outer")?.scopePath).toBe("");
    });
  });

  describe("registerFunction", () => {
    it("adds function to its scope", () => {
      const scope = registry.getOrCreateScope("Test");
      const func = FunctionUtils.create({
        name: "fillData",
        scopePath: "Test",
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "private",
        sourceFile: "test.cnx",
        span: TestSourceSpan.at(1),
      });
      registry.registerFunction(func);

      expect(scope.functions).toContain(func);
    });

    // #1358: idempotence is the contract of a declare pass, not compensation for
    // one caller -- #1313 targets "a pass is a pure function of its input". The
    // concrete failure that exposed it was Transpiler stages 3 and 5 each
    // resolving every file while reset() ran once per run, which appended a second
    // copy of every function in the program. #1301 removed that double pass, so
    // this test and the negative control below are now the guard's live callers,
    // holding it as a ratchet against a second unconditional pass reappearing.
    it("is idempotent -- re-registering the same declaration does not duplicate it", () => {
      const scope = registry.getOrCreateScope("Test");
      const make = () =>
        FunctionUtils.create({
          name: "fillData",
          scopePath: "Test",
          parameters: [],
          returnType: TTypeUtils.createPrimitive("void"),
          visibility: "private",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
        });

      // Two DISTINCT objects, as a second resolve of one tree produces.
      // Identity comparison would not catch this; fullyQualifiedCName does.
      const first = make();
      const second = make();
      expect(first).not.toBe(second);

      registry.registerFunction(first);
      registry.registerFunction(second);

      expect(scope.functions).toHaveLength(1);
    });

    // NEGATIVE CONTROL for the assertion above. getOrCreateScope is repeat-safe
    // by design -- that is how a scope spanned across two files merges (#1333).
    // A fix that keyed on the SCOPE rather than the symbol would pass the
    // idempotence test and break this one.
    it("still merges two different functions declared in the same scope from different files", () => {
      const scope = registry.getOrCreateScope("Motor");
      const start = FunctionUtils.create({
        name: "start",
        scopePath: "Motor",
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "public",
        sourceFile: "a.cnx",
        span: TestSourceSpan.at(2),
      });
      const stop = FunctionUtils.create({
        name: "stop",
        scopePath: "Motor",
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "public",
        sourceFile: "b.cnx",
        span: TestSourceSpan.at(2),
      });

      registry.registerFunction(start);
      registry.registerFunction(stop);

      expect(scope.functions.map((f) => f.name)).toEqual(["start", "stop"]);
    });
  });

  describe("resolveFunction", () => {
    it("finds function in current scope", () => {
      const scope = registry.getOrCreateScope("Test");
      const func = FunctionUtils.create({
        name: "fillData",
        scopePath: "Test",
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "private",
        sourceFile: "test.cnx",
        span: TestSourceSpan.at(1),
      });
      registry.registerFunction(func);

      const found = registry.resolveFunction("fillData", scope);
      expect(found).toBe(func);
    });

    it("finds function in parent scope", () => {
      const func = FunctionUtils.create({
        name: "helper",
        scopePath: "",
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "public",
        sourceFile: "test.cnx",
        span: TestSourceSpan.at(1),
      });
      registry.registerFunction(func);

      const childScope = registry.getOrCreateScope("Test");
      const found = registry.resolveFunction("helper", childScope);
      expect(found).toBe(func);
    });

    it("returns null for unknown function", () => {
      const scope = registry.getOrCreateScope("Test");
      const found = registry.resolveFunction("unknown", scope);
      expect(found).toBeNull();
    });
  });

  describe("reset", () => {
    it("clears all registered symbols", () => {
      registry.getOrCreateScope("Test");
      const func = FunctionUtils.create({
        name: "foo",
        scopePath: "Test",
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "private",
        sourceFile: "test.cnx",
        span: TestSourceSpan.at(1),
      });
      registry.registerFunction(func);

      const newGlobal = registry.getGlobalScope();
      expect(newGlobal.functions).toHaveLength(0);

      const found = registry.resolveFunction("foo", newGlobal);
      expect(found).toBeNull();
    });
  });

  describe("findByCName", () => {
    it("finds global function by bare name", () => {
      const func = FunctionUtils.create({
        name: "main",
        scopePath: "",
        parameters: [],
        returnType: TTypeUtils.createPrimitive("i32"),
        visibility: "public",
        sourceFile: "main.cnx",
        span: TestSourceSpan.at(1),
      });
      registry.registerFunction(func);

      const found = registry.findByCName("main");
      expect(found).toBe(func);
    });

    it("finds scoped function by transpiled C name", () => {
      registry.getOrCreateScope("Test");
      const func = FunctionUtils.create({
        name: "fillData",
        scopePath: "Test",
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "private",
        sourceFile: "test.cnx",
        span: TestSourceSpan.at(10),
      });
      registry.registerFunction(func);

      const found = registry.findByCName("Test__fillData");
      expect(found).toBe(func);
    });

    it("finds nested scope function by transpiled C name", () => {
      registry.getOrCreateScope("Outer.Inner");
      const func = FunctionUtils.create({
        name: "deepFunc",
        scopePath: "Outer.Inner",
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "private",
        sourceFile: "test.cnx",
        span: TestSourceSpan.at(20),
      });
      registry.registerFunction(func);

      const found = registry.findByCName("Outer__Inner__deepFunc");
      expect(found).toBe(func);
    });

    it("returns null for unknown function", () => {
      const found = registry.findByCName("Unknown__func");
      expect(found).toBeNull();
    });
  });

  describe("getScopeByCFunctionName", () => {
    it("returns scope for scoped function", () => {
      const scope = registry.getOrCreateScope("Motor");
      const func = FunctionUtils.create({
        name: "init",
        scopePath: "Motor",
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "public",
        sourceFile: "motor.cnx",
        span: TestSourceSpan.at(5),
      });
      registry.registerFunction(func);

      const foundScope = registry.getScopeByCFunctionName("Motor__init");
      expect(foundScope).toBe(scope);
    });

    it("returns global scope for global function", () => {
      const global = registry.getGlobalScope();
      const func = FunctionUtils.create({
        name: "helper",
        scopePath: "",
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "public",
        sourceFile: "helpers.cnx",
        span: TestSourceSpan.at(1),
      });
      registry.registerFunction(func);

      const foundScope = registry.getScopeByCFunctionName("helper");
      expect(foundScope).toBe(global);
    });

    it("returns null for unknown function", () => {
      const foundScope = registry.getScopeByCFunctionName("Unknown__func");
      expect(foundScope).toBeNull();
    });
  });
});
