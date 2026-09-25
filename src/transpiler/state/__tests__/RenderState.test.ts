/**
 * `RenderState` -- 2.3 Render's per-file working state (#1452 box 4).
 *
 * These cases moved here with their subject. They were on
 * `CodeGenState.test.ts` while the members were statics; the behavior they
 * pin is unchanged, and the negative controls came with them -- the include
 * funnel must raise ONE flag rather than blanket them, and only the two
 * headers with a claiming emitter record a deferred site.
 */
import { describe, it, expect, beforeEach } from "vitest";
import RenderState from "../RenderState";
import ToolchainRequirements from "../../../instrumentation/ToolchainRequirements";

describe("RenderState", () => {
  let state: RenderState;

  beforeEach(() => {
    state = new RenderState();
    ToolchainRequirements.reset();
  });

  describe("requireInclude -- the one include sink (#1449)", () => {
    // Parameterized rather than eight near-identical blocks: that shape is
    // SonarCloud S5976, and the six it replaces were exactly it.
    it.each([
      ["stdint", () => state.needsStdint],
      ["stdbool", () => state.needsStdbool],
      ["string", () => state.needsString],
      ["cmsis", () => state.needsCMSIS],
      ["limits", () => state.needsLimits],
      ["isr", () => state.needsISR],
      ["float_static_assert", () => state.needsFloatStaticAssert],
      ["irq_wrappers", () => state.needsIrqWrappers],
    ] as const)("%s raises its flag and no other", (header, read) => {
      expect(read()).toBe(false);
      state.requireInclude(header);
      expect(read()).toBe(true);
    });

    // Negative control: the funnel must raise ONE flag, not blanket them.
    // Without this the test above passes just as well against a body that
    // sets every flag on any call.
    it("raises only the flag it was asked for", () => {
      state.requireInclude("string");

      expect(state.needsString).toBe(true);
      expect(state.needsStdint).toBe(false);
      expect(state.needsStdbool).toBe(false);
      expect(state.needsCMSIS).toBe(false);
      expect(state.needsLimits).toBe(false);
      expect(state.needsISR).toBe(false);
      expect(state.needsFloatStaticAssert).toBe(false);
      expect(state.needsIrqWrappers).toBe(false);
    });

    // #1143: only the two headers with a claiming emitter are recorded as
    // deferred sites. "isr" is deliberately NOT one --
    // ToolchainRequirements.takeDeferredSites is called for
    // float_static_assert and irq_wrappers alone.
    //
    // #1452 moved the sink to src/instrumentation/, so the observation is made
    // there. The subject is still this funnel: requireInclude decides which
    // headers defer, and that decision is what these four rows pin.
    it.each([
      ["float_static_assert", true],
      ["irq_wrappers", true],
      ["isr", false],
      ["string", false],
    ] as const)("%s deferred-site recorded: %s", (header, recorded) => {
      state.requireInclude(header, 42);

      expect(ToolchainRequirements.takeDeferredSites(header).length > 0).toBe(
        recorded,
      );
    });
  });

  describe("clamp and safe-division helpers", () => {
    it("markClampOpUsed adds to usedClampOps", () => {
      state.markClampOpUsed("add", "u8");
      expect(state.usedClampOps.has("add_u8")).toBe(true);
    });
    it("markSafeDivOpUsed adds to usedSafeDivOps", () => {
      state.markSafeDivOpUsed("div", "i32");
      expect(state.usedSafeDivOps.has("div_i32")).toBe(true);
    });
  });
});
