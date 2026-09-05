import type IRequirementSite from "./IRequirementSite";

/**
 * The fully-resolved input to ONE file's emission decisions, captured at the
 * warm per-file moment.
 *
 * The `.c` analogue of `IHeaderEmissionFacts`, and captured for the same reason
 * (#1323): the answers below only exist once that file's declarations have been
 * generated, and they are gone the moment `CodeGenState.reset()` runs for the
 * next file. Freezing them into a record is what lets 2.2 Plan decide from a
 * value rather than from live state, and what lets 2.3 Render take a plan
 * instead of a state container.
 *
 * ## Questions, not answers
 *
 * Every field here is a QUESTION the file has raised -- "did anything ask for
 * `<string.h>`?". `IEmissionPlan` holds the answers. The split is the point:
 * the questions are what the generators accumulate while producing text, and
 * the answers are what a renderer may consume without deciding anything
 * further.
 */
interface IEmissionFacts {
  /** The `.cnx` these facts were captured from. */
  readonly sourcePath: string;

  /**
   * Whether this run emits C++.
   *
   * Read to DECIDE a keyword, never carried into the plan: #1313 grooming
   * decision 3 makes the plan per-file with no mode axis, because `cppMode` is
   * a monotone latch and therefore a Tier 2 fact rather than a dimension.
   */
  readonly cppMode: boolean;

  readonly needsStdint: boolean;
  readonly needsStdbool: boolean;
  readonly needsString: boolean;
  readonly needsCMSIS: boolean;
  readonly needsLimits: boolean;

  readonly needsFloatStaticAssert: boolean;
  readonly needsIrqWrappers: boolean;
  readonly needsISR: boolean;

  /**
   * Whether the implementation file includes its own header.
   *
   * The header owns ADR-040's `ISR` typedef, so a file that includes it must
   * not emit the typedef as well (#369/#1164).
   */
  readonly selfIncludeAdded: boolean;

  /**
   * Include targets the file already carries verbatim from its own source,
   * spelled as they are written (`"<stdint.h>"`).
   *
   * Passed in so the plan can decide the FINAL set rather than leaving a
   * renderer to subtract one list from another -- a subtraction is a decision,
   * and #1108's dedup used to make it by re-parsing text the renderer had
   * already emitted.
   */
  readonly existingIncludeTargets: readonly string[];

  /** ADR-044 clamp helper keys accumulated while generating (`"add_u32"`). */
  readonly clampOps: ReadonlySet<string>;

  /** ADR-051 safe-division helper keys accumulated while generating. */
  readonly safeDivOps: ReadonlySet<string>;

  /** Sites that asked for the float static asserts, for attribution. */
  readonly floatAssertSites: readonly IRequirementSite[];

  /** Sites that asked for the IRQ wrappers, for attribution. */
  readonly irqWrapperSites: readonly IRequirementSite[];
}

export default IEmissionFacts;
