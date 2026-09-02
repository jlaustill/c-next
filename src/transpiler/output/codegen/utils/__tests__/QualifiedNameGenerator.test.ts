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

describe("QualifiedNameGenerator", () => {
  beforeEach(() => {
    SymbolRegistry.reset();
  });

  describe("forFunction", () => {
    it("returns bare name for global scope function", () => {
      const func = FunctionUtils.create({
        name: "main",
        scopePath: "",
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
      SymbolRegistry.getOrCreateScope("Test");
      const func = FunctionUtils.create({
        name: "fillData",
        scopePath: "Test",
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
      SymbolRegistry.getOrCreateScope("Outer.Inner");
      const func = FunctionUtils.create({
        name: "deepFunc",
        scopePath: "Outer.Inner",
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
      SymbolRegistry.getOrCreateScope("A.B.C");
      const func = FunctionUtils.create({
        name: "veryDeep",
        scopePath: "A.B.C",
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

  // #1298 removed the `getScopePath` suite with the delegate it tested. It
  // asserted that a chain walk recovered ["Outer","Middle","Inner"] from a scope
  // object; a scope now carries that path as a field, so the property belongs to
  // construction and is asserted in ScopeUtils.test.ts ("createScope" and
  // "no scope cycle is representable").

  describe("forFunctionInScope", () => {
    it("returns bare name for a null scope", () => {
      expect(QualifiedNameGenerator.forFunctionInScope("", "main")).toBe(
        "main",
      );
    });

    it("returns transpiled C name for a simple scope", () => {
      SymbolRegistry.getOrCreateScope("Test");
      expect(
        QualifiedNameGenerator.forFunctionInScope("Test", "fillData"),
      ).toBe("Test__fillData");
    });

    it("keeps every outer component for a nested scope", () => {
      // #1285: the leaf-name signature this replaced dropped the outer scope, so
      // this returned `Inner__func`. #1298 makes the parameter a string again --
      // but the whole PATH, which carries the chain the scope object used to.
      SymbolRegistry.getOrCreateScope("Outer.Inner");

      expect(
        QualifiedNameGenerator.forFunctionInScope("Outer.Inner", "func"),
      ).toBe("Outer__Inner__func");
    });

    it("uses SymbolRegistry when function is registered", () => {
      const func = FunctionUtils.create({
        name: "init",
        scopePath: "Motor",
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "public",
        body: null,
        sourceFile: "motor.cnx",
        sourceLine: 1,
      });
      SymbolRegistry.registerFunction(func);

      expect(QualifiedNameGenerator.forFunctionInScope("Motor", "init")).toBe(
        "Motor__init",
      );
    });

    it("falls back to qualifying the bare name when not in the registry", () => {
      SymbolRegistry.getOrCreateScope("Unknown");

      expect(QualifiedNameGenerator.forFunctionInScope("Unknown", "func")).toBe(
        "Unknown__func",
      );
    });
  });

  describe("forMember", () => {
    it("returns bare name for a null scope", () => {
      expect(QualifiedNameGenerator.forMember("", "value")).toBe("value");
    });

    it("returns transpiled C name for a simple scope", () => {
      SymbolRegistry.getOrCreateScope("Test");
      expect(QualifiedNameGenerator.forMember("Test", "counter")).toBe(
        "Test__counter",
      );
    });

    it("keeps every outer component for a nested scope", () => {
      // The member counterpart of the guard above.
      SymbolRegistry.getOrCreateScope("OuterData");
      expect(
        QualifiedNameGenerator.forMember("OuterData.InnerData", "data"),
      ).toBe("OuterData__InnerData__data");
    });
  });
});
