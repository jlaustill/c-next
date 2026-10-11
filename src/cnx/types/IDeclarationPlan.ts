/**
 * 2.2 Plan's decisions about DECLARATIONS, settled before any is rendered.
 *
 * `docs/architecture/README.md` §1 gives 2.2 Plan "declarations and order,
 * includes, helpers, MISRA annotations, toolchain requirements". Every field of
 * `IEmissionPlan` is includes-or-helpers, because that plan is built from facts
 * the declarations RAISE while rendering and so cannot exist before them. The
 * two answers here do not depend on rendering anything, so they can be decided
 * first -- which is the only way a renderer can read a declaration decision
 * rather than interpret a flag.
 *
 * ## Why this is separate from `IEmissionPlan` rather than a field on it
 *
 * The two are decided at different moments in the same pass. This one is
 * settled once the self-include is placed and the declaration kinds are known;
 * `IEmissionPlan` cannot be built until `generateAllDeclarations` has run,
 * because "does this file need `<string.h>`?" is answered by what the
 * declarations turned out to contain. Folding them into one record would
 * require either building it twice or leaving half its fields undefined for the
 * span where Render needs the other half -- and a field a renderer must first
 * check is present is the interpretation this split exists to remove.
 *
 * #1517's commit named the same shape from the other side: "the header's would
 * have to live in 2.2 Plan and the plan would need the declarations -- which
 * the renderer still produces."
 */
interface IDeclarationPlan {
  /**
   * Whether the included header owns this file's type definitions, so the
   * implementation file does not also define them.
   *
   * The DECISION, not the `selfIncludeAdded` fact it comes from. Five sites
   * used to derive it independently from that flag (#1450); they then shared
   * one derivation function, and each still fetched the flag and called it,
   * which is a decision made five times with one implementation rather than a
   * decision made once.
   *
   * Covers the TYPE only. ADR-029's struct init function has external linkage
   * and no other home, so it is emitted regardless -- suppressing a whole
   * generator on this dropped that function once already (#1164).
   */
  readonly headerOwnsTypeDefinitions: boolean;

  /**
   * Index of the declaration the ADR-029 callback typedef block precedes, or
   * null to place it last.
   *
   * `DeclarationOrder` has always owned this, but its answer was computed
   * inside `generateAllDeclarations` and consumed on the spot, so it never
   * reached an artifact. Where the block LANDS in the emitted array stays
   * Render's: that index depends on how many leading-comment lines were
   * pushed, which is a fact about text rather than a decision about what C
   * should exist.
   */
  readonly callbackTypedefsPrecede: number | null;
}

export default IDeclarationPlan;
