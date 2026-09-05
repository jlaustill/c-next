import type IPlannedBlock from "./IPlannedBlock";

/**
 * 2.2 Plan's artifact: what C should exist for ONE file.
 *
 * `docs/architecture/README.md` §1 -- "**2.2 decides, 2.3 formats.** 'Does this
 * file need `<stdint.h>`?' is decided once, in the plan. Render reads the plan
 * and produces text from it."
 *
 * ## Per-file, and no mode field
 *
 * #1313 grooming decision 3. `cppMode` is a one-shot latch -- seeded from
 * `--cpp`, raised by reading an included header, never lowered -- so it is
 * monotone, therefore order-independent, therefore a Tier 2 fact on `Program`
 * rather than an axis a plan is indexed by. The plan READS it to decide
 * `keyword` above; it does not carry it, and there is no (file x mode) pair.
 *
 * ## What may live here, and what may not
 *
 * Every field must be a DECISION -- an answer to "what C should exist?" that a
 * renderer consumes without asking anything further. A field a renderer has to
 * interpret is a decision that did not get made, and the interpretation is the
 * second derivation this artifact exists to remove.
 *
 * That is why `systemIncludes` holds `"<stdint.h>"` and not `needsStdint`: the
 * flag is a question, the string is the answer. Before #1449 the `.c` asked the
 * flag and emitted conditionally while the header emitted `<stdint.h>` and
 * `<stdbool.h>` unconditionally -- one question with two derivations that
 * agreed only where both happened to be true.
 */
interface IEmissionPlan {
  /** The `.cnx` this plan is for. */
  readonly sourcePath: string;

  /**
   * System headers the implementation file includes, already spelled as they
   * are emitted and in emission order. Empty when it needs none.
   */
  readonly systemIncludes: readonly string[];

  /** The float-size static asserts, or null when the file has no float bit indexing. */
  readonly floatStaticAssert: IPlannedBlock | null;

  /**
   * The IRQ wrapper chain, or null when the file opens no critical section.
   *
   * Carries ALL four platform requirements, never one: the emitted block is a
   * single `#if`/`#elif`/`#else` chain and which arm applies is decided by the
   * compiler, not here. Recording one would force an answer to a per-target
   * question (#1143).
   */
  readonly irqWrappers: IPlannedBlock | null;

  /**
   * Whether the file emits ADR-040's `ISR` typedef itself.
   *
   * False when the file includes its own header, which owns the typedef --
   * emitting both is a redeclaration error (#369/#1164).
   */
  readonly isrTypedef: boolean;

  /** ADR-044 overflow-clamp helper keys (`"add_u32"`), in emission order. */
  readonly clampOps: readonly string[];

  /** ADR-051 safe-division helper keys (`"div_u32"`), in emission order. */
  readonly safeDivOps: readonly string[];
}

export default IEmissionPlan;
