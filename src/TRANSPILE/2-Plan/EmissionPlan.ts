/**
 * 2.2 Plan -- decides what C should exist for one file.
 *
 * `docs/architecture/README.md` §1 gives this pass sole ownership of
 * declarations and order, includes, helpers, MISRA annotations and toolchain
 * requirements, and states the rule it exists to make checkable:
 *
 *   **2.2 decides, 2.3 formats.** "Does this file need `<stdint.h>`?" is
 *   decided once, in the plan. Render reads the plan and produces text from it.
 *
 * ## Why a decision, and not a flag, crosses the boundary
 *
 * Before this pass, `CodeGenState.needsStdint` crossed it -- and a flag is a
 * question, so every reader answered it again. `CodeGenerator.addAutoIncludes`
 * answered "emit `<stdint.h>` if the flag is set"; `HeaderGeneratorUtils`
 * answered "emit `<stdint.h>` always". One question, two derivations, agreeing
 * only on the files where both happened to be true. That is the shape CLAUDE.md
 * calls the project's worst anti-pattern, and it is why `systemIncludes` below
 * holds the strings to emit rather than the booleans to interpret.
 *
 * ## Shape
 *
 * Follows `Program` (1.4 Resolve): a `build` returning a frozen record, with
 * each derivation its own named step so that "why is `<limits.h>` here?" has an
 * answer that fits on a screen. Unlike `Program` it needs no query surface --
 * a plan is consumed field by field by one renderer, not queried by many
 * passes -- so the record is the artifact rather than a closure over hidden
 * tables.
 *
 * ## Why there is no negative control in this pass
 *
 * `Program` (1.4 Resolve) carries one -- it refuses to return while any type
 * is still deferred -- and that is right there, because a deferred type CAN
 * survive its derivation and the type system cannot say so.
 *
 * This pass is total over its inputs: every branch that plans a block writes
 * a non-empty requirement list from a literal or a module constant, so a
 * block carrying no cost is not reachable from any `IEmissionFacts`. A guard
 * for it would be one more thing that cannot fail on the case it exists to
 * catch, which is the `/* test-no-warnings *\/` shape (#1143) -- and the
 * property it would assert is asserted instead by the unit tests, which pin
 * each block's exact requirement list. One draft of this file had that guard;
 * it is recorded here so the next reader does not add it back believing it
 * ever ran.
 */

import type IEmissionFacts from "../../transpiler/types/IEmissionFacts";
import type IEmissionPlan from "../../transpiler/types/IEmissionPlan";
import type IPlannedBlock from "../../transpiler/types/IPlannedBlock";
import type TRequirementKey from "../../transpiler/types/TRequirementKey";
import SYSTEM_INCLUDE_TARGETS from "../../transpiler/constants/SYSTEM_INCLUDE_TARGETS";

/**
 * The four platform arms of the emitted IRQ wrapper chain.
 *
 * All four are carried, never one. The block is a single `#if`/`#elif`/`#else`,
 * so which arm applies is decided by the compiler and not here; recording a
 * single "critical section" requirement would force one answer to a per-target
 * question, which is how a requirements table starts lying (#1143).
 */
const IRQ_WRAPPER_REQUIREMENTS: readonly TRequirementKey[] = [
  "critical-arm-gnu",
  "critical-arduino",
  "critical-avr-libc",
  "critical-cmsis-fallback",
];

/**
 * System headers in emission order, each paired with the fact that asks for it.
 *
 * A list rather than five `if` statements so that the order is data: adding a
 * header is one row, and the order it emits in is visible in one place instead
 * of being the order somebody happened to write the branches.
 */
const SYSTEM_INCLUDES: readonly {
  readonly target: string;
  readonly needed: (facts: IEmissionFacts) => boolean;
}[] = [
  { target: SYSTEM_INCLUDE_TARGETS.stdint!, needed: (f) => f.needsStdint },
  { target: SYSTEM_INCLUDE_TARGETS.stdbool!, needed: (f) => f.needsStdbool },
  { target: SYSTEM_INCLUDE_TARGETS.string!, needed: (f) => f.needsString },
  { target: SYSTEM_INCLUDE_TARGETS.cmsis!, needed: (f) => f.needsCMSIS },
  { target: SYSTEM_INCLUDE_TARGETS.limits!, needed: (f) => f.needsLimits },
];

class EmissionPlan {
  /**
   * Decide this file's emission from the facts captured while it was warm.
   *
   * @param facts one file's accumulated questions, frozen at the warm moment
   */
  static build(facts: IEmissionFacts): IEmissionPlan {
    const plan: IEmissionPlan = {
      sourcePath: facts.sourcePath,
      systemIncludes: EmissionPlan.decideSystemIncludes(facts),
      floatStaticAssert: EmissionPlan.decideFloatStaticAssert(facts),
      irqWrappers: EmissionPlan.decideIrqWrappers(facts),
      isrTypedef: facts.needsISR && !facts.selfIncludeAdded,
      clampOps: [...facts.clampOps],
      safeDivOps: [...facts.safeDivOps],
    };

    return Object.freeze(plan);
  }

  /**
   * Which system headers the implementation file emits, already deduplicated
   * against what its own source includes.
   *
   * The subtraction happens here, not in the renderer. #1108 fixed the same
   * duplicate by having the renderer re-parse `#include` lines it had already
   * pushed -- which made the emitted text an input to the decision, so the
   * answer depended on how much of the file had been rendered so far.
   */
  private static decideSystemIncludes(
    facts: IEmissionFacts,
  ): readonly string[] {
    const already = new Set(facts.existingIncludeTargets);
    const decided: string[] = [];
    for (const candidate of SYSTEM_INCLUDES) {
      if (!candidate.needed(facts) || already.has(candidate.target)) {
        continue;
      }
      decided.push(candidate.target);
      already.add(candidate.target);
    }
    return decided;
  }

  /**
   * The float-size static asserts, with the keyword and the requirement key
   * decided together.
   *
   * `_Static_assert` is C11 and `static_assert` is C++11, and the pair has to
   * move together or the banner claims a standard the text does not use. They
   * used to be produced by one ternary at the emission site, which kept them in
   * step by co-location; here they are two fields of one record, which keeps
   * them in step by construction.
   */
  private static decideFloatStaticAssert(
    facts: IEmissionFacts,
  ): IPlannedBlock | null {
    if (!facts.needsFloatStaticAssert) return null;
    return {
      keyword: facts.cppMode ? "static_assert" : "_Static_assert",
      requirements: [facts.cppMode ? "float-assert-cpp11" : "float-assert-c11"],
      sites: facts.floatAssertSites,
    };
  }

  /** The IRQ wrapper chain and all four of its platform requirements. */
  private static decideIrqWrappers(
    facts: IEmissionFacts,
  ): IPlannedBlock | null {
    if (!facts.needsIrqWrappers) return null;
    return {
      keyword: null,
      requirements: IRQ_WRAPPER_REQUIREMENTS,
      sites: facts.irqWrapperSites,
    };
  }
}

export default EmissionPlan;
