/**
 * Unit tests for SymbolPathUtils
 *
 * #1298 deleted the `buildScopePath` and `getDotPathId` suites along with the
 * functions. They walked a scope's parent chain to rebuild a dotted path, and
 * their most detailed cases -- four levels of nesting, and a scope that is its
 * own parent -- were exercising a walk that no longer happens. A symbol's dotted
 * path is now `cnxScopedName`, computed once at construction, so the properties
 * those cases protected are asserted where the path is BUILT
 * (`ScopeUtils.test.ts`: identity at depth three, and "no scope cycle is
 * representable") rather than where it used to be recomputed.
 */

import { describe, expect, it } from "vitest";
import SymbolPathUtils from "../SymbolPathUtils";

describe("SymbolPathUtils", () => {
  describe("getParentId", () => {
    it("returns undefined for file scope", () => {
      expect(SymbolPathUtils.getParentId("")).toBeUndefined();
    });

    it("returns the path for a single-level scope", () => {
      expect(SymbolPathUtils.getParentId("LED")).toBe("LED");
    });

    it("returns the whole path for a nested scope, not its leaf", () => {
      expect(SymbolPathUtils.getParentId("Teensy4.GPIO7")).toBe(
        "Teensy4.GPIO7",
      );
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
