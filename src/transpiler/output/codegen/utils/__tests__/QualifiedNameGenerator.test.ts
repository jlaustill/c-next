/**
 * Tests for QualifiedNameGenerator
 *
 * QualifiedNameGenerator is the ONLY place that constructs C-style mangled names
 * like "Test_fillData" from function symbols.
 */
import { describe, it, expect, beforeEach } from "vitest";
import QualifiedNameGenerator from "../QualifiedNameGenerator";
import SymbolRegistry from "../../../../state/SymbolRegistry";
import FunctionUtils from "../../../../types/FunctionUtils";
import TTypeUtils from "../../../../types/TTypeUtils";

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

      expect(QualifiedNameGenerator.forFunction(func)).toBe("Test_fillData");
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
        "Outer_Inner_deepFunc",
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

      expect(QualifiedNameGenerator.forFunction(func)).toBe("A_B_C_veryDeep");
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
});
