import { describe, it, expect } from "vitest";
import SetMapHelper from "../SetMapHelper.js";

describe("SetMapHelper", () => {
  describe("findNewItems", () => {
    it("finds items in source but not in target", () => {
      const source = new Set(["a", "b", "c"]);
      const target = new Set(["a", "b"]);
      const result = SetMapHelper.findNewItems(source, target);
      expect(result).toEqual(new Set(["c"]));
    });

    it("returns empty set when all items exist in target", () => {
      const source = new Set(["a", "b"]);
      const target = new Set(["a", "b", "c"]);
      const result = SetMapHelper.findNewItems(source, target);
      expect(result.size).toBe(0);
    });

    it("returns all items when target is empty", () => {
      const source = new Set(["a", "b"]);
      const target = new Set<string>();
      const result = SetMapHelper.findNewItems(source, target);
      expect(result).toEqual(new Set(["a", "b"]));
    });

    it("returns empty set when source is empty", () => {
      const source = new Set<string>();
      const target = new Set(["a", "b"]);
      const result = SetMapHelper.findNewItems(source, target);
      expect(result.size).toBe(0);
    });
  });

  describe("restoreMapState", () => {
    it("clears target and copies from saved", () => {
      const target = new Map([
        ["a", 1],
        ["b", 2],
      ]);
      const saved = new Map([
        ["c", 3],
        ["d", 4],
      ]);
      SetMapHelper.restoreMapState(target, saved);
      expect(target).toEqual(
        new Map([
          ["c", 3],
          ["d", 4],
        ]),
      );
    });

    it("handles empty saved map", () => {
      const target = new Map([["a", 1]]);
      const saved = new Map<string, number>();
      SetMapHelper.restoreMapState(target, saved);
      expect(target.size).toBe(0);
    });

    it("handles empty target map", () => {
      const target = new Map<string, number>();
      const saved = new Map([["a", 1]]);
      SetMapHelper.restoreMapState(target, saved);
      expect(target).toEqual(new Map([["a", 1]]));
    });
  });

  describe("filterExclude", () => {
    it("excludes keys present in exclude map", () => {
      const source = new Map([
        ["a", 1],
        ["b", 2],
        ["c", 3],
      ]);
      const exclude = new Map([["b", true]]);
      const result = SetMapHelper.filterExclude(source, exclude);
      expect(result).toEqual(
        new Map([
          ["a", 1],
          ["c", 3],
        ]),
      );
    });

    it("returns all entries when exclude is undefined", () => {
      const source = new Map([
        ["a", 1],
        ["b", 2],
      ]);
      const result = SetMapHelper.filterExclude(source, undefined);
      expect(result).toEqual(source);
    });

    it("returns all entries when exclude is empty", () => {
      const source = new Map([
        ["a", 1],
        ["b", 2],
      ]);
      const exclude = new Map<string, unknown>();
      const result = SetMapHelper.filterExclude(source, exclude);
      expect(result).toEqual(source);
    });

    it("returns empty map when source is empty", () => {
      const source = new Map<string, number>();
      const exclude = new Map([["a", true]]);
      const result = SetMapHelper.filterExclude(source, exclude);
      expect(result.size).toBe(0);
    });
  });

  describe("copyArrayValues", () => {
    it("creates independent copies of array values", () => {
      const source = new Map([
        ["a", [1, 2]],
        ["b", [3, 4]],
      ]);
      const result = SetMapHelper.copyArrayValues(source);

      expect(result).toEqual(source);

      // Verify they are independent copies
      source.get("a")!.push(5);
      expect(result.get("a")).toEqual([1, 2]);
    });

    it("handles empty source map", () => {
      const source = new Map<string, number[]>();
      const result = SetMapHelper.copyArrayValues(source);
      expect(result.size).toBe(0);
    });

    it("handles empty array values", () => {
      const source = new Map([["a", [] as number[]]]);
      const result = SetMapHelper.copyArrayValues(source);
      expect(result.get("a")).toEqual([]);
    });
  });
});
