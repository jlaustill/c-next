/**
 * Unit tests for TransitiveModificationPropagator
 * Issue #269: Tests for transitive parameter modification propagation
 */

import { describe, it, expect } from "vitest";
import TransitiveModificationPropagator from "../TransitiveModificationPropagator.js";

/**
 * Reproduces the pre-#1178 answer for an unresolvable callee ("assume pure").
 * Every fixture below uses a callee that resolves, so this is never consulted;
 * it keeps each existing case testing exactly what it tested before.
 */
const assumeUnresolvableIsPure = (): boolean => false;

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
        assumeUnresolvableIsPure,
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
        assumeUnresolvableIsPure,
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
        assumeUnresolvableIsPure,
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
        assumeUnresolvableIsPure,
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
        assumeUnresolvableIsPure,
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
        assumeUnresolvableIsPure,
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
        assumeUnresolvableIsPure,
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
        assumeUnresolvableIsPure,
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
        assumeUnresolvableIsPure,
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
        assumeUnresolvableIsPure,
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
        assumeUnresolvableIsPure,
      );

      expect(modifiedParameters.get("d")!.has("z")).toBe(true);
      expect(modifiedParameters.get("b")!.has("p")).toBe(true);
      expect(modifiedParameters.get("c")!.has("q")).toBe(true);
      expect(modifiedParameters.get("a")!.has("x")).toBe(true);
    });
  });

  describe("unresolvable callee (#1178)", () => {
    // The propagator cannot see the callee's parameter list -- it is a C/C++
    // function, or nothing declares it. Before #1178 this returned false, the
    // same answer as "the callee is pure", so auto-const was applied on the
    // strength of an absent answer.
    const graphCallingUnknown = () =>
      new Map([
        ["caller", [{ callee: "unknown", paramIndex: 0, argParamName: "x" }]],
      ]);
    const paramListsWithoutCallee = () => new Map([["caller", ["x"]]]);

    it("withholds auto-const when the resolver says the callee may mutate", () => {
      const modifiedParameters = new Map([["caller", new Set<string>()]]);

      TransitiveModificationPropagator.propagate(
        graphCallingUnknown(),
        paramListsWithoutCallee(),
        modifiedParameters,
        () => true,
      );

      expect(modifiedParameters.get("caller")).toEqual(new Set(["x"]));
    });

    it("leaves auto-const in place when the resolver proves pass-by-value", () => {
      const modifiedParameters = new Map([["caller", new Set<string>()]]);

      TransitiveModificationPropagator.propagate(
        graphCallingUnknown(),
        paramListsWithoutCallee(),
        modifiedParameters,
        () => false,
      );

      expect(modifiedParameters.get("caller")).toEqual(new Set());
    });

    it("consults the resolver with the callee name and parameter index", () => {
      const asked: Array<[string, number]> = [];
      const modifiedParameters = new Map([["caller", new Set<string>()]]);

      TransitiveModificationPropagator.propagate(
        new Map([
          [
            "caller",
            [{ callee: "widget_move", paramIndex: 1, argParamName: "x" }],
          ],
        ]),
        paramListsWithoutCallee(),
        modifiedParameters,
        (callee, paramIndex) => {
          asked.push([callee, paramIndex]);
          return false;
        },
      );

      expect(asked).toContainEqual(["widget_move", 1]);
    });

    it("treats a parameter index past the callee's arity as unresolvable", () => {
      // The callee resolves, but not at this position -- still an absent answer.
      const modifiedParameters = new Map([
        ["caller", new Set<string>()],
        ["callee", new Set<string>()],
      ]);

      TransitiveModificationPropagator.propagate(
        new Map([
          ["caller", [{ callee: "callee", paramIndex: 3, argParamName: "x" }]],
        ]),
        new Map([
          ["caller", ["x"]],
          ["callee", ["only"]],
        ]),
        modifiedParameters,
        () => true,
      );

      expect(modifiedParameters.get("caller")).toEqual(new Set(["x"]));
    });

    it("does not consult the resolver when the callee resolves", () => {
      let consulted = false;
      const modifiedParameters = new Map([
        ["caller", new Set<string>()],
        ["callee", new Set(["param"])],
      ]);

      TransitiveModificationPropagator.propagate(
        new Map([
          ["caller", [{ callee: "callee", paramIndex: 0, argParamName: "x" }]],
        ]),
        new Map([
          ["caller", ["x"]],
          ["callee", ["param"]],
        ]),
        modifiedParameters,
        () => {
          consulted = true;
          return false;
        },
      );

      expect(consulted).toBe(false);
      expect(modifiedParameters.get("caller")).toEqual(new Set(["x"]));
    });
  });
});
