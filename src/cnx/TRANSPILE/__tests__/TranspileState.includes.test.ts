/**
 * `TranspileState` -- 2.3 Render's per-file working state (#1452 box 4).
 *
 * These cases moved here with their subject. They were on
 * `CodeGenState.test.ts` while the members were statics; the behavior they
 * pin is unchanged, and the negative controls came with them -- the include
 * funnel must raise ONE flag rather than blanket them, and only the two
 * headers whose sites a plan block carries record a deferred site.
 */
import { describe, it, expect, beforeEach } from "vitest";
import TranspileState from "../TranspileState";
import ToolchainRequirements from "../../instrumentation/ToolchainRequirements";
import type IEmissionPlan from "../../types/IEmissionPlan";
import type TDeferredSiteKey from "../../types/TDeferredSiteKey";

describe("TranspileState", () => {
  let state = new TranspileState();

  beforeEach(() => {
    state = new TranspileState();
    ToolchainRequirements.reset();
  });

  describe("requireInclude -- the one include sink (#1449)", () => {
    // Parameterized rather than eight near-identical blocks: that shape is
    // SonarCloud S5976, and the six it replaces were exactly it.
    it.each([
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
      expect(state.needsCMSIS).toBe(false);
      expect(state.needsLimits).toBe(false);
      expect(state.needsISR).toBe(false);
      expect(state.needsFloatStaticAssert).toBe(false);
      expect(state.needsIrqWrappers).toBe(false);
    });

    // #1143: only the two headers whose sites a plan block carries are
    // recorded as deferred sites. "isr" is deliberately NOT one --
    // ToolchainRequirements.takeDeferredSites is called for
    // float_static_assert and irq_wrappers alone.
    //
    // #1452 moved the sink to instrumentation/, so the observation is made
    // there. The subject is still this funnel: requireInclude decides which
    // headers defer, and that decision is what these four rows pin.
    const DEFERRED_KEYS: readonly TDeferredSiteKey[] = [
      "irq_wrappers",
      "float_static_assert",
      "ldrex_strex_loop",
    ];
    it.each([
      ["float_static_assert", ["float_static_assert"]],
      ["irq_wrappers", ["irq_wrappers"]],
      ["isr", []],
      ["string", []],
    ] as const)("%s defers a site under: %j", (header, deferred) => {
      state.requireInclude(header, 42);

      expect(
        DEFERRED_KEYS.filter(
          (key) => ToolchainRequirements.takeDeferredSites(key).length > 0,
        ),
      ).toEqual(deferred);
    });

    // #1452: the sink's third argument. `requireInclude` briefly took
    // `sourcePath` as a parameter no caller supplied, so every site recorded
    // `""` -- and `ResultPrinter` filters on `sourcePath.length > 0`, so #1143's
    // file:line attribution went dark while the row above stayed green. A
    // `length > 0` assertion cannot see the difference between a located site
    // and an unlocated one, which is why the path is asserted here.
    it("records the file the requirement came from, not just that it came", () => {
      state.sourcePath = "a.cnx";

      state.requireInclude("float_static_assert", 7);

      expect(
        ToolchainRequirements.takeDeferredSites("float_static_assert"),
      ).toEqual([{ sourcePath: "a.cnx", line: 7 }]);
    });
  });

  describe("clamp and safe-division helpers", () => {
    it("markClampOpUsed adds to usedClampOps", () => {
      state.markClampOpUsed("add", "u8");
      expect(state.usedClampOps.has("add_u8")).toBe(true);
    });
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

// #1997: Render reports the forms it emitted; 2.2 reads them once, at the
// plan build. A form noted after that would vanish from the banner and the
// file result without failing, so the write is refused instead.
const FORMS = [
  [
    "LDREX/STREX loop",
    (s: TranspileState) => s.noteLdrexStrexLoop(),
    (s: TranspileState) => s.emittedLdrexStrexLoop,
  ],
] as const;

describe("TranspileState -- emitted forms", () => {
  let state = new TranspileState();

  beforeEach(() => {
    state = new TranspileState();
    ToolchainRequirements.reset();
  });

  it.each(FORMS)(
    "records a %s before the plan, and refuses one after",
    (form, note, emitted) => {
      expect(emitted(state)).toBe(false);
      note(state);
      expect(emitted(state)).toBe(true);

      state.emissionPlanOrNull = {} as IEmissionPlan;
      expect(() => note(state)).toThrow(`a ${form} was emitted after 2.2 Plan`);
    },
  );

  // #1991: the emission plan is built before 2.3 writes, so a requirement
  // 2.3 raises would cost nothing.
  it("refuses a requirement after the plan", () => {
    state.requireInclude("string");
    expect(state.needsString).toBe(true);

    state.emissionPlanOrNull = {} as IEmissionPlan;
    expect(() => state.requireInclude("limits")).toThrow(
      "a <limits> requirement was emitted after 2.2 Plan",
    );
  });

  // #1143's leak shape: a form one file emitted must not cost the next file.
  it.each(FORMS)("reset clears a noted %s", (_form, note, emitted) => {
    note(state);
    state.reset();
    expect(emitted(state)).toBe(false);
  });

  it("notes the LDREX/STREX site for attribution", () => {
    state.sourcePath = "a.cnx";
    state.noteLdrexStrexLoop();

    expect(ToolchainRequirements.takeDeferredSites("ldrex_strex_loop")).toEqual(
      [{ sourcePath: "a.cnx", line: null }],
    );
  });
});
