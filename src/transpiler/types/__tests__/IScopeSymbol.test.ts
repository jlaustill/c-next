import { describe, it, expect } from "vitest";
import ScopeUtils from "../../../utils/ScopeUtils";

describe("IScopeSymbol", () => {
  describe("createGlobalScope", () => {
    it("creates global scope with self-reference parent", () => {
      const global = ScopeUtils.createGlobalScope();
      expect(global.kind).toBe("scope");
      expect(global.name).toBe("");
      expect(global.parent).toBe(global); // Self-reference
      expect(global.functions).toEqual([]);
      expect(global.variables).toEqual([]);
    });
  });

  describe("createScope", () => {
    it("creates named scope with parent reference", () => {
      const global = ScopeUtils.createGlobalScope();
      const test = ScopeUtils.createScope("Test", global);
      expect(test.kind).toBe("scope");
      expect(test.name).toBe("Test");
      expect(test.parent).toBe(global);
    });

    it("supports nested scopes", () => {
      const global = ScopeUtils.createGlobalScope();
      const outer = ScopeUtils.createScope("Outer", global);
      const inner = ScopeUtils.createScope("Inner", outer);
      expect(inner.parent).toBe(outer);
      expect(outer.parent).toBe(global);
    });

    it("initializes empty functions and variables arrays", () => {
      const global = ScopeUtils.createGlobalScope();
      const scope = ScopeUtils.createScope("Test", global);
      expect(scope.functions).toEqual([]);
      expect(scope.variables).toEqual([]);
    });
  });

  describe("isGlobalScope", () => {
    it("returns true for global scope", () => {
      const global = ScopeUtils.createGlobalScope();
      expect(ScopeUtils.isGlobalScope(global)).toBe(true);
    });

    it("returns false for named scope", () => {
      const global = ScopeUtils.createGlobalScope();
      const scope = ScopeUtils.createScope("Test", global);
      expect(ScopeUtils.isGlobalScope(scope)).toBe(false);
    });
  });
});
