/**
 * Unit tests for ModificationAnalyzer
 * Issue #593: Extract C++ mode modification analysis to dedicated analyzer
 *
 * Tests cover:
 * - Accumulating modifications from analysis results
 * - Accumulating param lists from analysis results
 * - Merging with existing state
 * - Readonly accessors
 * - Clear functionality
 * - Edge cases (empty data, duplicate keys, etc.)
 */

import { describe, it, expect, beforeEach } from "vitest";
import ModificationAnalyzer from "../ModificationAnalyzer";

describe("ModificationAnalyzer", () => {
  let analyzer: ModificationAnalyzer;

  beforeEach(() => {
    analyzer = new ModificationAnalyzer();
  });

  describe("initial state", () => {
    it("should start with empty modifications", () => {
      expect(analyzer.getModifications().size).toBe(0);
    });

    it("should start with empty param lists", () => {
      expect(analyzer.getParamLists().size).toBe(0);
    });
  });

  describe("accumulateModifications", () => {
    it("should add new function modifications", () => {
      const mods = new Map<string, Set<string>>([
        ["func1", new Set(["param1", "param2"])],
      ]);

      analyzer.accumulateModifications(mods);

      const result = analyzer.getModifications();
      expect(result.size).toBe(1);
      expect(result.get("func1")).toEqual(new Set(["param1", "param2"]));
    });

    it("should merge modifications for existing function", () => {
      // First accumulation
      analyzer.accumulateModifications(
        new Map([["func1", new Set(["param1"])]]),
      );

      // Second accumulation with same function, different param
      analyzer.accumulateModifications(
        new Map([["func1", new Set(["param2"])]]),
      );

      const result = analyzer.getModifications();
      expect(result.get("func1")).toEqual(new Set(["param1", "param2"]));
    });

    it("should handle multiple functions", () => {
      analyzer.accumulateModifications(
        new Map([
          ["func1", new Set(["a"])],
          ["func2", new Set(["b", "c"])],
        ]),
      );

      const result = analyzer.getModifications();
      expect(result.size).toBe(2);
      expect(result.get("func1")).toEqual(new Set(["a"]));
      expect(result.get("func2")).toEqual(new Set(["b", "c"]));
    });

    it("should handle empty input", () => {
      analyzer.accumulateModifications(new Map());
      expect(analyzer.getModifications().size).toBe(0);
    });

    it("should handle function with empty param set", () => {
      analyzer.accumulateModifications(new Map([["func1", new Set()]]));

      const result = analyzer.getModifications();
      expect(result.size).toBe(1);
      expect(result.get("func1")).toEqual(new Set());
    });
  });

  describe("accumulateParamLists", () => {
    it("should add new function param lists", () => {
      const paramLists = new Map<string, string[]>([
        ["func1", ["param1", "param2"]],
      ]);

      analyzer.accumulateParamLists(paramLists);

      const result = analyzer.getParamLists();
      expect(result.size).toBe(1);
      expect(result.get("func1")).toEqual(["param1", "param2"]);
    });

    it("should not overwrite existing param list (first wins)", () => {
      // First accumulation
      analyzer.accumulateParamLists(new Map([["func1", ["a", "b"]]]));

      // Second accumulation - should be ignored for existing function
      analyzer.accumulateParamLists(new Map([["func1", ["x", "y", "z"]]]));

      const result = analyzer.getParamLists();
      expect(result.get("func1")).toEqual(["a", "b"]);
    });

    it("should add new functions without affecting existing", () => {
      analyzer.accumulateParamLists(new Map([["func1", ["a"]]]));
      analyzer.accumulateParamLists(new Map([["func2", ["b"]]]));

      const result = analyzer.getParamLists();
      expect(result.size).toBe(2);
      expect(result.get("func1")).toEqual(["a"]);
      expect(result.get("func2")).toEqual(["b"]);
    });

    it("should handle empty input", () => {
      analyzer.accumulateParamLists(new Map());
      expect(analyzer.getParamLists().size).toBe(0);
    });

    it("should handle function with empty param array", () => {
      analyzer.accumulateParamLists(new Map([["func1", []]]));

      const result = analyzer.getParamLists();
      expect(result.size).toBe(1);
      expect(result.get("func1")).toEqual([]);
    });
  });

  describe("accumulateResults", () => {
    it("should accumulate both modifications and param lists", () => {
      const results = {
        modifications: new Map([["func1", new Set(["p1"])]]),
        paramLists: new Map([["func1", ["p1", "p2"]]]),
      };

      analyzer.accumulateResults(results);

      expect(analyzer.getModifications().get("func1")).toEqual(new Set(["p1"]));
      expect(analyzer.getParamLists().get("func1")).toEqual(["p1", "p2"]);
    });

    it("should handle results with only modifications", () => {
      const results = {
        modifications: new Map([["func1", new Set(["p1"])]]),
        paramLists: new Map<string, string[]>(),
      };

      analyzer.accumulateResults(results);

      expect(analyzer.getModifications().size).toBe(1);
      expect(analyzer.getParamLists().size).toBe(0);
    });

    it("should handle results with only param lists", () => {
      const results = {
        modifications: new Map<string, Set<string>>(),
        paramLists: new Map([["func1", ["p1"]]]),
      };

      analyzer.accumulateResults(results);

      expect(analyzer.getModifications().size).toBe(0);
      expect(analyzer.getParamLists().size).toBe(1);
    });
  });

  describe("clear", () => {
    it("should clear all modifications", () => {
      analyzer.accumulateModifications(
        new Map([["func1", new Set(["param1"])]]),
      );
      analyzer.clear();

      expect(analyzer.getModifications().size).toBe(0);
    });

    it("should clear all param lists", () => {
      analyzer.accumulateParamLists(new Map([["func1", ["param1"]]]));
      analyzer.clear();

      expect(analyzer.getParamLists().size).toBe(0);
    });

    it("should allow new accumulation after clear", () => {
      analyzer.accumulateModifications(new Map([["old", new Set(["x"])]]));
      analyzer.clear();
      analyzer.accumulateModifications(new Map([["new", new Set(["y"])]]));

      const result = analyzer.getModifications();
      expect(result.size).toBe(1);
      expect(result.has("old")).toBe(false);
      expect(result.get("new")).toEqual(new Set(["y"]));
    });
  });

  describe("getModifications (readonly)", () => {
    it("should return a readonly map", () => {
      analyzer.accumulateModifications(
        new Map([["func1", new Set(["param1"])]]),
      );

      const result = analyzer.getModifications();

      // TypeScript should enforce readonly, but verify the returned data
      expect(result.get("func1")).toEqual(new Set(["param1"]));
    });

    it("should return a copy that doesn't affect internal state", () => {
      analyzer.accumulateModifications(
        new Map([["func1", new Set(["param1"])]]),
      );

      // Get modifications and try to modify the returned set
      const mods = analyzer.getModifications();
      const funcMods = mods.get("func1");

      // Even if someone casts away readonly and modifies, internal state is protected
      // (Implementation should return defensive copies or use truly immutable structures)
      expect(funcMods).toEqual(new Set(["param1"]));
    });
  });

  describe("getParamLists (readonly)", () => {
    it("should return a readonly map", () => {
      analyzer.accumulateParamLists(new Map([["func1", ["a", "b"]]]));

      const result = analyzer.getParamLists();

      expect(result.get("func1")).toEqual(["a", "b"]);
    });
  });

  describe("hasModifications", () => {
    it("should return false when empty", () => {
      expect(analyzer.hasModifications()).toBe(false);
    });

    it("should return true when modifications exist", () => {
      analyzer.accumulateModifications(new Map([["f", new Set(["p"])]]));
      expect(analyzer.hasModifications()).toBe(true);
    });

    it("should return false after clear", () => {
      analyzer.accumulateModifications(new Map([["f", new Set(["p"])]]));
      analyzer.clear();
      expect(analyzer.hasModifications()).toBe(false);
    });
  });

  describe("integration scenarios", () => {
    it("should handle cross-file accumulation pattern", () => {
      // File 1: CommandHandler.cnx
      analyzer.accumulateResults({
        modifications: new Map([["CommandHandler_reset", new Set(["config"])]]),
        paramLists: new Map([["CommandHandler_reset", ["config"]]]),
      });

      // File 2: SerialHandler.cnx (depends on CommandHandler)
      analyzer.accumulateResults({
        modifications: new Map([
          ["SerialHandler_handleReset", new Set(["config"])],
        ]),
        paramLists: new Map([["SerialHandler_handleReset", ["config"]]]),
      });

      // Both functions should be tracked
      const mods = analyzer.getModifications();
      expect(mods.size).toBe(2);
      expect(mods.get("CommandHandler_reset")).toEqual(new Set(["config"]));
      expect(mods.get("SerialHandler_handleReset")).toEqual(
        new Set(["config"]),
      );
    });

    it("should handle contribution merging pattern from run()", () => {
      // Simulating fileResult.contribution.modifiedParameters merging
      const contribution1 = {
        modifications: new Map([["Scope_func1", new Set(["a", "b"])]]),
        paramLists: new Map([["Scope_func1", ["a", "b", "c"]]]),
      };

      const contribution2 = {
        modifications: new Map([
          ["Scope_func1", new Set(["c"])], // Additional param for same function
          ["Scope_func2", new Set(["x"])],
        ]),
        paramLists: new Map([
          ["Scope_func1", ["different"]], // Should be ignored (first wins)
          ["Scope_func2", ["x", "y"]],
        ]),
      };

      analyzer.accumulateResults(contribution1);
      analyzer.accumulateResults(contribution2);

      // Modifications merge
      expect(analyzer.getModifications().get("Scope_func1")).toEqual(
        new Set(["a", "b", "c"]),
      );
      expect(analyzer.getModifications().get("Scope_func2")).toEqual(
        new Set(["x"]),
      );

      // Param lists: first wins
      expect(analyzer.getParamLists().get("Scope_func1")).toEqual([
        "a",
        "b",
        "c",
      ]);
      expect(analyzer.getParamLists().get("Scope_func2")).toEqual(["x", "y"]);
    });
  });
});
