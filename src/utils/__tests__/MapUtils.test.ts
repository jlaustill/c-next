import { describe, expect, it } from "vitest";
import MapUtils from "../MapUtils.js";

describe("MapUtils", () => {
  describe("deepCopyStringSetMap", () => {
    it("should return empty map for empty input", () => {
      const source = new Map<string, Set<string>>();
      const result = MapUtils.deepCopyStringSetMap(source);

      expect(result.size).toBe(0);
      expect(result).not.toBe(source);
    });

    it("should deep copy map with single entry", () => {
      const source = new Map<string, Set<string>>([
        ["func1", new Set(["param1", "param2"])],
      ]);

      const result = MapUtils.deepCopyStringSetMap(source);

      expect(result.size).toBe(1);
      expect(result.get("func1")).toEqual(new Set(["param1", "param2"]));
    });

    it("should deep copy map with multiple entries", () => {
      const source = new Map<string, Set<string>>([
        ["func1", new Set(["a", "b"])],
        ["func2", new Set(["c"])],
        ["func3", new Set(["d", "e", "f"])],
      ]);

      const result = MapUtils.deepCopyStringSetMap(source);

      expect(result.size).toBe(3);
      expect(result.get("func1")).toEqual(new Set(["a", "b"]));
      expect(result.get("func2")).toEqual(new Set(["c"]));
      expect(result.get("func3")).toEqual(new Set(["d", "e", "f"]));
    });

    it("should create independent Map instance", () => {
      const source = new Map<string, Set<string>>([
        ["func1", new Set(["param1"])],
      ]);

      const result = MapUtils.deepCopyStringSetMap(source);

      // Modify source - should not affect result
      source.set("func2", new Set(["new"]));
      source.delete("func1");

      expect(result.size).toBe(1);
      expect(result.has("func1")).toBe(true);
      expect(result.has("func2")).toBe(false);
    });

    it("should create independent Set instances", () => {
      const originalSet = new Set(["param1", "param2"]);
      const source = new Map<string, Set<string>>([["func1", originalSet]]);

      const result = MapUtils.deepCopyStringSetMap(source);

      // Modify original Set - should not affect result
      originalSet.add("param3");
      originalSet.delete("param1");

      const resultSet = result.get("func1");
      expect(resultSet).toBeDefined();
      expect(resultSet!.has("param1")).toBe(true);
      expect(resultSet!.has("param2")).toBe(true);
      expect(resultSet!.has("param3")).toBe(false);
    });

    it("should handle empty Sets in map", () => {
      const source = new Map<string, Set<string>>([
        ["func1", new Set()],
        ["func2", new Set(["a"])],
      ]);

      const result = MapUtils.deepCopyStringSetMap(source);

      expect(result.get("func1")?.size).toBe(0);
      expect(result.get("func2")?.size).toBe(1);
    });
  });
});
