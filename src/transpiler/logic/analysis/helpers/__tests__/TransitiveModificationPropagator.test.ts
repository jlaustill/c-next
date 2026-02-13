/**
 * Unit tests for TransitiveModificationPropagator
 * Issue #269: Tests for transitive parameter modification propagation
 */

import { describe, it, expect } from "vitest";
import TransitiveModificationPropagator from "../TransitiveModificationPropagator.js";

describe("TransitiveModificationPropagator", () => {
  describe("propagate", () => {
    it("does nothing when call graph is empty", () => {
      const functionCallGraph = new Map<
        string,
        Array<{ callee: string; paramIndex: number; argParamName: string }>
      >();
      const functionParamLists = new Map<string, string[]>();
      const modifiedParameters = new Map<string, Set<string>>();

      TransitiveModificationPropagator.propagate(
        functionCallGraph,
        functionParamLists,
        modifiedParameters,
      );

      expect(modifiedParameters.size).toBe(0);
    });

    it("does nothing when no parameters are modified", () => {
      const functionCallGraph = new Map([
        ["caller", [{ callee: "callee", paramIndex: 0, argParamName: "x" }]],
      ]);
      const functionParamLists = new Map([
        ["caller", ["x"]],
        ["callee", ["param"]],
      ]);
      const modifiedParameters = new Map([
        ["caller", new Set<string>()],
        ["callee", new Set<string>()],
      ]);

      TransitiveModificationPropagator.propagate(
        functionCallGraph,
        functionParamLists,
        modifiedParameters,
      );

      expect(modifiedParameters.get("caller")!.size).toBe(0);
      expect(modifiedParameters.get("callee")!.size).toBe(0);
    });

    it("propagates direct modification to caller", () => {
      // caller(x) calls callee(x) and callee modifies its param
      const functionCallGraph = new Map([
        ["caller", [{ callee: "callee", paramIndex: 0, argParamName: "x" }]],
      ]);
      const functionParamLists = new Map([
        ["caller", ["x"]],
        ["callee", ["param"]],
      ]);
      const modifiedParameters = new Map([
        ["caller", new Set<string>()],
        ["callee", new Set(["param"])],
      ]);

      TransitiveModificationPropagator.propagate(
        functionCallGraph,
        functionParamLists,
        modifiedParameters,
      );

      expect(modifiedParameters.get("caller")!.has("x")).toBe(true);
    });

    it("propagates modification through chain of calls", () => {
      // a(x) -> b(x) -> c(x), where c modifies its param
      const functionCallGraph = new Map([
        ["a", [{ callee: "b", paramIndex: 0, argParamName: "x" }]],
        ["b", [{ callee: "c", paramIndex: 0, argParamName: "y" }]],
      ]);
      const functionParamLists = new Map([
        ["a", ["x"]],
        ["b", ["y"]],
        ["c", ["z"]],
      ]);
      const modifiedParameters = new Map([
        ["a", new Set<string>()],
        ["b", new Set<string>()],
        ["c", new Set(["z"])],
      ]);

      TransitiveModificationPropagator.propagate(
        functionCallGraph,
        functionParamLists,
        modifiedParameters,
      );

      expect(modifiedParameters.get("c")!.has("z")).toBe(true);
      expect(modifiedParameters.get("b")!.has("y")).toBe(true);
      expect(modifiedParameters.get("a")!.has("x")).toBe(true);
    });

    it("handles multiple parameters correctly", () => {
      // caller(a, b) calls callee(a, b) where only second param is modified
      const functionCallGraph = new Map([
        [
          "caller",
          [
            { callee: "callee", paramIndex: 0, argParamName: "a" },
            { callee: "callee", paramIndex: 1, argParamName: "b" },
          ],
        ],
      ]);
      const functionParamLists = new Map([
        ["caller", ["a", "b"]],
        ["callee", ["x", "y"]],
      ]);
      const modifiedParameters = new Map([
        ["caller", new Set<string>()],
        ["callee", new Set(["y"])], // Only y is modified
      ]);

      TransitiveModificationPropagator.propagate(
        functionCallGraph,
        functionParamLists,
        modifiedParameters,
      );

      expect(modifiedParameters.get("caller")!.has("a")).toBe(false);
      expect(modifiedParameters.get("caller")!.has("b")).toBe(true);
    });

    it("handles out-of-bounds parameter index gracefully", () => {
      // Call with paramIndex > actual param count
      const functionCallGraph = new Map([
        ["caller", [{ callee: "callee", paramIndex: 5, argParamName: "x" }]],
      ]);
      const functionParamLists = new Map([
        ["caller", ["x"]],
        ["callee", ["a", "b"]], // Only 2 params, but index is 5
      ]);
      const modifiedParameters = new Map([
        ["caller", new Set<string>()],
        ["callee", new Set(["a", "b"])],
      ]);

      // Should not throw, should skip this call
      TransitiveModificationPropagator.propagate(
        functionCallGraph,
        functionParamLists,
        modifiedParameters,
      );

      expect(modifiedParameters.get("caller")!.has("x")).toBe(false);
    });

    it("handles missing callee param list gracefully", () => {
      const functionCallGraph = new Map([
        ["caller", [{ callee: "unknown", paramIndex: 0, argParamName: "x" }]],
      ]);
      const functionParamLists = new Map([["caller", ["x"]]]);
      const modifiedParameters = new Map([["caller", new Set<string>()]]);

      // Should not throw
      TransitiveModificationPropagator.propagate(
        functionCallGraph,
        functionParamLists,
        modifiedParameters,
      );

      expect(modifiedParameters.get("caller")!.has("x")).toBe(false);
    });

    it("handles missing caller modified set gracefully", () => {
      const functionCallGraph = new Map([
        ["caller", [{ callee: "callee", paramIndex: 0, argParamName: "x" }]],
      ]);
      const functionParamLists = new Map([
        ["caller", ["x"]],
        ["callee", ["y"]],
      ]);
      const modifiedParameters = new Map([
        // caller not in modifiedParameters
        ["callee", new Set(["y"])],
      ]);

      // Should not throw
      TransitiveModificationPropagator.propagate(
        functionCallGraph,
        functionParamLists,
        modifiedParameters,
      );

      // Caller should not be added to modifiedParameters since it wasn't tracked
      expect(modifiedParameters.has("caller")).toBe(false);
    });

    it("handles circular call dependencies", () => {
      // a calls b, b calls a (mutual recursion)
      const functionCallGraph = new Map([
        ["a", [{ callee: "b", paramIndex: 0, argParamName: "x" }]],
        ["b", [{ callee: "a", paramIndex: 0, argParamName: "y" }]],
      ]);
      const functionParamLists = new Map([
        ["a", ["x"]],
        ["b", ["y"]],
      ]);
      const modifiedParameters = new Map([
        ["a", new Set(["x"])], // a modifies x
        ["b", new Set<string>()],
      ]);

      // Should terminate and propagate correctly
      TransitiveModificationPropagator.propagate(
        functionCallGraph,
        functionParamLists,
        modifiedParameters,
      );

      // b's y should now be marked as modified (since a modifies x)
      expect(modifiedParameters.get("b")!.has("y")).toBe(true);
    });

    it("does not duplicate already-modified parameters", () => {
      const functionCallGraph = new Map([
        ["caller", [{ callee: "callee", paramIndex: 0, argParamName: "x" }]],
      ]);
      const functionParamLists = new Map([
        ["caller", ["x"]],
        ["callee", ["y"]],
      ]);
      const modifiedParameters = new Map([
        ["caller", new Set(["x"])], // Already modified
        ["callee", new Set(["y"])],
      ]);

      TransitiveModificationPropagator.propagate(
        functionCallGraph,
        functionParamLists,
        modifiedParameters,
      );

      // Should still have x, but no infinite loop
      expect(modifiedParameters.get("caller")!.has("x")).toBe(true);
      expect(modifiedParameters.get("caller")!.size).toBe(1);
    });

    it("handles diamond dependency pattern", () => {
      //     a
      //    / \
      //   b   c
      //    \ /
      //     d (modifies param)
      const functionCallGraph = new Map([
        [
          "a",
          [
            { callee: "b", paramIndex: 0, argParamName: "x" },
            { callee: "c", paramIndex: 0, argParamName: "x" },
          ],
        ],
        ["b", [{ callee: "d", paramIndex: 0, argParamName: "p" }]],
        ["c", [{ callee: "d", paramIndex: 0, argParamName: "q" }]],
      ]);
      const functionParamLists = new Map([
        ["a", ["x"]],
        ["b", ["p"]],
        ["c", ["q"]],
        ["d", ["z"]],
      ]);
      const modifiedParameters = new Map([
        ["a", new Set<string>()],
        ["b", new Set<string>()],
        ["c", new Set<string>()],
        ["d", new Set(["z"])],
      ]);

      TransitiveModificationPropagator.propagate(
        functionCallGraph,
        functionParamLists,
        modifiedParameters,
      );

      expect(modifiedParameters.get("d")!.has("z")).toBe(true);
      expect(modifiedParameters.get("b")!.has("p")).toBe(true);
      expect(modifiedParameters.get("c")!.has("q")).toBe(true);
      expect(modifiedParameters.get("a")!.has("x")).toBe(true);
    });
  });
});
