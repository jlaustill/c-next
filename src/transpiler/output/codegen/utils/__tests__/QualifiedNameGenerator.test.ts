/**
 * Tests for QualifiedNameGenerator
 *
 * QualifiedNameGenerator is the ONLY place that constructs transpiled C names
 * like "Test__fillData" from function symbols.
 */
import { describe, it, expect, beforeEach } from "vitest";
import QualifiedNameGenerator from "../QualifiedNameGenerator";
import SymbolRegistry from "../../../../state/SymbolRegistry";
import FunctionUtils from "../../../../../utils/FunctionUtils";
import TTypeUtils from "../../../../../utils/TTypeUtils";
import ScopeUtils from "../../../../../utils/ScopeUtils";

describe("QualifiedNameGenerator", () => {
  beforeEach(() => {
    SymbolRegistry.reset();
  });

  describe("forFunction", () => {
    it("returns bare name for global scope function", () => {
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

      expect(QualifiedNameGenerator.forFunction(func)).toBe("main");
    });

    it("returns Scope_name for scoped function", () => {
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

      expect(QualifiedNameGenerator.forFunction(func)).toBe("Test__fillData");
    });

    it("returns Outer_Inner_name for nested scope function", () => {
      const scope = SymbolRegistry.getOrCreateScope("Outer.Inner");
      const func = FunctionUtils.create({
        name: "deepFunc",
        scope,
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "private",
        body: null,
        sourceFile: "test.cnx",
        sourceLine: 1,
      });

      expect(QualifiedNameGenerator.forFunction(func)).toBe(
        "Outer__Inner__deepFunc",
      );
    });

    it("returns deeply nested path for 3-level scope", () => {
      const scope = SymbolRegistry.getOrCreateScope("A.B.C");
      const func = FunctionUtils.create({
        name: "veryDeep",
        scope,
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "public",
        body: null,
        sourceFile: "test.cnx",
        sourceLine: 1,
      });

      expect(QualifiedNameGenerator.forFunction(func)).toBe(
        "A__B__C__veryDeep",
      );
    });
  });

  describe("getScopePath", () => {
    it("returns empty array for global scope", () => {
      const global = SymbolRegistry.getGlobalScope();
      expect(QualifiedNameGenerator.getScopePath(global)).toEqual([]);
    });

    it("returns single element for direct child of global", () => {
      const scope = SymbolRegistry.getOrCreateScope("Test");
      expect(QualifiedNameGenerator.getScopePath(scope)).toEqual(["Test"]);
    });

    it("returns full path for nested scope", () => {
      const scope = SymbolRegistry.getOrCreateScope("A.B.C");
      expect(QualifiedNameGenerator.getScopePath(scope)).toEqual([
        "A",
        "B",
        "C",
      ]);
    });

    it("returns path in correct order (outermost first)", () => {
      const scope = SymbolRegistry.getOrCreateScope("Outer.Middle.Inner");
      expect(QualifiedNameGenerator.getScopePath(scope)).toEqual([
        "Outer",
        "Middle",
        "Inner",
      ]);
    });
  });

  describe("forFunctionInScope", () => {
    it("returns bare name for a null scope", () => {
      expect(QualifiedNameGenerator.forFunctionInScope(null, "main")).toBe(
        "main",
      );
    });

    it("returns transpiled C name for a simple scope", () => {
      const scope = SymbolRegistry.getOrCreateScope("Test");
      expect(QualifiedNameGenerator.forFunctionInScope(scope, "fillData")).toBe(
        "Test__fillData",
      );
    });

    it("walks the parent chain for a nested scope", () => {
      // #1285: the string signature this replaced took a scope NAME, so a nested
      // scope could only be expressed by pre-flattening it to "Outer.Inner" at the
      // call site -- and any caller holding a symbol had to read `.name` off it,
      // which is the leaf. That call site returned `Inner__func`. The symbol
      // carries the chain, so the outer component cannot be dropped.
      const outer = SymbolRegistry.getOrCreateScope("Outer");
      const inner = ScopeUtils.createScope("Inner", outer);
      expect(QualifiedNameGenerator.forFunctionInScope(inner, "func")).toBe(
        "Outer__Inner__func",
      );
    });

    it("uses SymbolRegistry when function is registered", () => {
      const scope = SymbolRegistry.getOrCreateScope("Motor");
      const func = FunctionUtils.create({
        name: "init",
        scope,
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "public",
        body: null,
        sourceFile: "motor.cnx",
        sourceLine: 1,
      });
      SymbolRegistry.registerFunction(func);

      expect(QualifiedNameGenerator.forFunctionInScope(scope, "init")).toBe(
        "Motor__init",
      );
    });

    it("falls back to qualifying the bare name when not in the registry", () => {
      const scope = SymbolRegistry.getOrCreateScope("Unknown");
      expect(QualifiedNameGenerator.forFunctionInScope(scope, "func")).toBe(
        "Unknown__func",
      );
    });
  });

  describe("forMember", () => {
    it("returns bare name for a null scope", () => {
      expect(QualifiedNameGenerator.forMember(null, "value")).toBe("value");
    });

    it("returns transpiled C name for a simple scope", () => {
      const scope = SymbolRegistry.getOrCreateScope("Test");
      expect(QualifiedNameGenerator.forMember(scope, "counter")).toBe(
        "Test__counter",
      );
    });

    it("walks the parent chain for a nested scope", () => {
      // The member counterpart of the guard above.
      const outer = SymbolRegistry.getOrCreateScope("OuterData");
      const inner = ScopeUtils.createScope("InnerData", outer);
      expect(QualifiedNameGenerator.forMember(inner, "data")).toBe(
        "OuterData__InnerData__data",
      );
    });
  });
});
