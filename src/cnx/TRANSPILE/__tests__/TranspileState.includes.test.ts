/**
 * `TranspileState` -- 2.3 Render's per-file working state (#1452 box 4).
 *
 * The include funnel's cases moved to `2-Plan/__tests__/PlannedRequirements`
 * when 2.2 stopped writing this state for them (#1991).
 */
import { describe, it, expect, beforeEach } from "vitest";
import TranspileState from "../TranspileState";

describe("TranspileState", () => {
  let state = new TranspileState();

  beforeEach(() => {
    state = new TranspileState();
  });

  // Opaque scope variables used to be tracked here by generated name, a second
  // store of what the member's declared type already says; a call site reads
  // that type now (#1668), and the fixtures under tests/bugs that pass scope
  // handles to C functions guard it.

  describe("withPlannedExpectedType()", () => {
    it("sets the planned type and suppression during callback", () => {
      state.expectedType = "u32";
      state.suppressBareEnumResolution = false;
      let inside: [string | null, boolean] = ["notSet", false];

      state.withPlannedExpectedType("u8", true, () => {
        inside = [state.expectedType, state.suppressBareEnumResolution];
      });

      expect(inside).toEqual(["u8", true]);
    });

    it("sets no type when 2.2 planned none, not the outer one", () => {
      state.expectedType = "u32";
      state.suppressBareEnumResolution = true;
      let inside: [string | null, boolean] = ["notCleared", true];

      state.withPlannedExpectedType(null, false, () => {
        inside = [state.expectedType, state.suppressBareEnumResolution];
      });

      expect(inside).toEqual([null, false]);
    });

    it("returns the callback result", () => {
      const result = state.withPlannedExpectedType(null, false, () => 123);
      expect(result).toBe(123);
    });

    it("restores values on exception", () => {
      state.expectedType = "bool";
      state.suppressBareEnumResolution = true;

      expect(() =>
        state.withPlannedExpectedType("u8", false, () => {
          throw new Error("test error");
        }),
      ).toThrow("test error");

      expect(state.expectedType).toBe("bool");
      expect(state.suppressBareEnumResolution).toBe(true);
    });
  });
});
