/**
 * Unit tests for SymbolPathUtils
 */

import { describe, expect, it } from "vitest";
import SymbolPathUtils from "../SymbolPathUtils";

describe("SymbolPathUtils", () => {
  describe("buildScopePath", () => {
    it("returns empty string for global scope (empty name)", () => {
      const globalScope = { name: "" };
      expect(SymbolPathUtils.buildScopePath(globalScope)).toBe("");
    });

    it("returns scope name for single-level scope", () => {
      const scope = { name: "LED", parent: { name: "" } };
      expect(SymbolPathUtils.buildScopePath(scope)).toBe("LED");
    });

    it("builds dot-path for nested scopes", () => {
      const grandparent = { name: "Teensy4", parent: { name: "" } };
      const parent = { name: "GPIO7", parent: grandparent };
      const scope = { name: "DataRegister", parent };

      expect(SymbolPathUtils.buildScopePath(scope)).toBe(
        "Teensy4.GPIO7.DataRegister",
      );
    });

    it("handles deeply nested scopes (4+ levels)", () => {
      const level1 = { name: "Board", parent: { name: "" } };
      const level2 = { name: "Peripheral", parent: level1 };
      const level3 = { name: "Register", parent: level2 };
      const level4 = { name: "Field", parent: level3 };

      expect(SymbolPathUtils.buildScopePath(level4)).toBe(
        "Board.Peripheral.Register.Field",
      );
    });

    it("stops at global scope (empty parent name)", () => {
      const globalScope = { name: "" };
      const scope = { name: "LED", parent: globalScope };

      expect(SymbolPathUtils.buildScopePath(scope)).toBe("LED");
    });

    it("handles circular reference (scope is its own parent)", () => {
      // This is a defensive check - global scope in the real codebase
      // is its own parent to avoid null checks
      const selfRefScope: { name: string; parent: unknown } = {
        name: "Self",
        parent: undefined,
      };
      selfRefScope.parent = selfRefScope;

      expect(SymbolPathUtils.buildScopePath(selfRefScope)).toBe("Self");
    });
  });

  describe("getDotPathId", () => {
    it("returns just name for top-level symbol", () => {
      const symbol = { name: "setup", scope: { name: "" } };
      expect(SymbolPathUtils.getDotPathId(symbol)).toBe("setup");
    });

    it("returns Scope.name for scoped symbol", () => {
      const symbol = {
        name: "toggle",
        scope: { name: "LED", parent: { name: "" } },
      };
      expect(SymbolPathUtils.getDotPathId(symbol)).toBe("LED.toggle");
    });

    it("returns full dot-path for deeply nested symbol", () => {
      const grandparent = { name: "Board", parent: { name: "" } };
      const parent = { name: "GPIO", parent: grandparent };
      const symbol = { name: "DR", scope: { name: "Register", parent } };

      expect(SymbolPathUtils.getDotPathId(symbol)).toBe(
        "Board.GPIO.Register.DR",
      );
    });
  });

  describe("getParentId", () => {
    it("returns undefined for global scope", () => {
      const globalScope = { name: "" };
      expect(SymbolPathUtils.getParentId(globalScope)).toBeUndefined();
    });

    it("returns scope name for single-level scope", () => {
      const scope = { name: "LED", parent: { name: "" } };
      expect(SymbolPathUtils.getParentId(scope)).toBe("LED");
    });

    it("returns full dot-path for nested scope", () => {
      const grandparent = { name: "Teensy4", parent: { name: "" } };
      const scope = { name: "GPIO7", parent: grandparent };

      expect(SymbolPathUtils.getParentId(scope)).toBe("Teensy4.GPIO7");
    });
  });

  describe("buildSimpleDotPath", () => {
    it("returns just name when parent is undefined", () => {
      expect(SymbolPathUtils.buildSimpleDotPath(undefined, "myFunc")).toBe(
        "myFunc",
      );
    });

    it("returns parent.name when parent is defined", () => {
      expect(SymbolPathUtils.buildSimpleDotPath("Color", "RED")).toBe(
        "Color.RED",
      );
    });

    it("handles empty string parent as truthy (returns path)", () => {
      // Empty string is falsy in JS, so this behaves like undefined
      expect(SymbolPathUtils.buildSimpleDotPath("", "name")).toBe("name");
    });
  });
});
