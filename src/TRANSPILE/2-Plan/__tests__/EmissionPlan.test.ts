/**
 * #1449: 2.2 Plan decides; 2.3 Render formats.
 *
 * The assertions here are about DECISIONS, not text. What the float assert
 * renders as is Render's business; that the keyword and the requirement key it
 * costs are one record is this pass's, and it is the property #1143 and #1449
 * were in apparent conflict over.
 */

import EmissionPlan from "../EmissionPlan";
import type IEmissionFacts from "../../../transpiler/types/IEmissionFacts";

const NOTHING: IEmissionFacts = {
  sourcePath: "main.cnx",
  cppMode: false,
  needsStdint: false,
  needsStdbool: false,
  needsString: false,
  needsCMSIS: false,
  needsLimits: false,
  needsFloatStaticAssert: false,
  needsIrqWrappers: false,
  needsISR: false,
  selfIncludeAdded: false,
  existingIncludeTargets: [],
  clampOps: new Set<string>(),
  safeDivOps: new Set<string>(),
  floatAssertSites: [],
  irqWrapperSites: [],
};

const facts = (over: Partial<IEmissionFacts>): IEmissionFacts => ({
  ...NOTHING,
  ...over,
});

describe("EmissionPlan (2.2 Plan)", () => {
  describe("system includes", () => {
    it.each([
      ["needsStdint", "<stdint.h>"],
      ["needsStdbool", "<stdbool.h>"],
      ["needsString", "<string.h>"],
      ["needsCMSIS", "<cmsis_gcc.h>"],
      ["needsLimits", "<limits.h>"],
    ] as const)("%s decides %s", (flag, target) => {
      const plan = EmissionPlan.build(facts({ [flag]: true }));

      expect(plan.systemIncludes).toEqual([target]);
    });

    it("emits nothing when nothing asked", () => {
      expect(EmissionPlan.build(NOTHING).systemIncludes).toEqual([]);
    });

    // Order is data (SYSTEM_INCLUDES), not the order somebody wrote branches.
    //
    // Asks for ALL FIVE deliberately. An earlier version of this test set three
    // of them and asserted their order, which reads as an order assertion and
    // is not one: transposing two headers it did not ask for changed nothing,
    // and the mutation that swapped `<stdint.h>` with `<stdbool.h>` passed it.
    // A permutation is only observable when every element is present.
    it("keeps a fixed emission order", () => {
      const plan = EmissionPlan.build(
        facts({
          needsStdint: true,
          needsStdbool: true,
          needsString: true,
          needsCMSIS: true,
          needsLimits: true,
        }),
      );

      expect(plan.systemIncludes).toEqual([
        "<stdint.h>",
        "<stdbool.h>",
        "<string.h>",
        "<cmsis_gcc.h>",
        "<limits.h>",
      ]);
    });

    // #1108's dedup, decided rather than recovered from emitted text.
    it("does not re-emit a header the source already includes", () => {
      const plan = EmissionPlan.build(
        facts({
          needsStdint: true,
          needsString: true,
          existingIncludeTargets: ["<stdint.h>"],
        }),
      );

      expect(plan.systemIncludes).toEqual(["<string.h>"]);
    });
  });

  describe("float static assert -- keyword and cost are one record", () => {
    it.each([
      [false, "_Static_assert", "float-assert-c11"],
      [true, "static_assert", "float-assert-cpp11"],
    ] as const)(
      "cppMode=%s decides %s costing %s",
      (cppMode, keyword, requirement) => {
        const plan = EmissionPlan.build(
          facts({ cppMode, needsFloatStaticAssert: true }),
        );

        expect(plan.floatStaticAssert).toEqual({
          keyword,
          requirements: [requirement],
          sites: [],
        });
      },
    );

    it("is absent when no float bit indexing occurred", () => {
      expect(EmissionPlan.build(NOTHING).floatStaticAssert).toBeNull();
    });

    it("carries the sites that asked, for attribution", () => {
      const sites = [{ sourcePath: "main.cnx", line: 12 }];
      const plan = EmissionPlan.build(
        facts({ needsFloatStaticAssert: true, floatAssertSites: sites }),
      );

      expect(plan.floatStaticAssert?.sites).toEqual(sites);
    });
  });

  describe("IRQ wrappers", () => {
    // All four arms, never one: which applies is the compiler's decision.
    it("carries every platform arm's requirement", () => {
      const plan = EmissionPlan.build(facts({ needsIrqWrappers: true }));

      expect(plan.irqWrappers?.requirements).toEqual([
        "critical-arm-gnu",
        "critical-arduino",
        "critical-avr-libc",
        "critical-cmsis-fallback",
      ]);
    });

    it("is absent when no critical section was opened", () => {
      expect(EmissionPlan.build(NOTHING).irqWrappers).toBeNull();
    });
  });

  describe("ISR typedef", () => {
    it.each([
      [false, true],
      [true, false],
    ] as const)(
      "selfIncludeAdded=%s -> emits typedef %s",
      (selfIncludeAdded, expected) => {
        const plan = EmissionPlan.build(
          facts({ needsISR: true, selfIncludeAdded }),
        );

        expect(plan.isrTypedef).toBe(expected);
      },
    );
  });

  describe("the artifact itself", () => {
    it("is frozen, so no consumer can decide anything afterwards", () => {
      const plan = EmissionPlan.build(NOTHING);

      expect(Object.isFrozen(plan)).toBe(true);
    });

    it("carries helper keys as decided lists", () => {
      const plan = EmissionPlan.build(
        facts({
          clampOps: new Set(["add_u32"]),
          safeDivOps: new Set(["div_u32"]),
        }),
      );

      expect(plan.clampOps).toEqual(["add_u32"]);
      expect(plan.safeDivOps).toEqual(["div_u32"]);
    });
  });
});
