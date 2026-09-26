/**
 * Issue #1143: what the generated output for one file costs the reader's
 * toolchain, recorded by each emitter at the moment it produces the text.
 *
 * Consumers read this; nothing re-derives it. PR #1141 failed by re-deriving --
 * its `#error` guard keyed on `usedClampOps.size > 0` while the emission it
 * described keyed on the template family, so 96 snapshots shipped a guard for a
 * builtin they did not contain. Recording at the emission site is what makes a
 * consumer unable to disagree with what was emitted.
 *
 * ## Why this is instrumentation (#1452)
 *
 * A toolchain requirement is a fact ABOUT the run's output, not a fact the run
 * computes in order to decide anything. Both consumers are self-report: the
 * banner comment on the `.c`/`.cpp`, so someone handed a generated file can see
 * what it needs without the `.cnx` or this repository, and
 * `ITranspilerResult.requirements`. No branch anywhere reads a recorded
 * requirement to choose what to emit -- the `needs*` flags decide that, and the
 * sites travel alongside as attribution.
 *
 * ## What this does NOT need, and AdrProvenance does
 *
 * [[AdrProvenance]] sits here under a stated exemption from box 4: it is
 * genuinely cross-pass, written at 17 `record` sites spanning 2.1 Analyze and
 * 2.3 Render and read once at the end of the run. This module claims no such
 * exemption, because it is not cross-pass state at all. Measured on
 * `e16b5f03`, every write is inside 2.3 Render:
 *
 * | Write site                            | Pass          |
 * | ------------------------------------- | ------------- |
 * | `CodeGenWalker` (4 sites)             | 2.3 Render    |
 * | `CodeGenerator.applyEffects`          | 2.3 Render    |
 * | `HelperGenerator`                     | 2.3 Render    |
 * | `CodeGenState.requireInclude`         | 2.3 Render    |
 *
 * and every read -- `takeDeferredSites` at plan-build, `collect` for the banner
 * and for the result -- happens inside the same `generate()` call for the same
 * file. The one `requireInclude` caller outside Render
 * (`TypeRegistrationEngine`, 2.2 Plan) passes `"string"`, which is not a
 * deferred key and records no requirement, so it cannot reach either map.
 *
 * That makes the move out of `CodeGenState` a correction rather than a
 * relocation: the accumulation was per-file and single-pass the whole time, and
 * only the container it sat in was cross-pass. Do not read its presence in this
 * root as a precedent for parking cross-pass state here to get out from under
 * `passes-hold-no-mutable-state.test.ts` -- the table above is the claim, and it
 * is the thing to re-measure if a write site is ever added from an earlier pass.
 */
import RequirementSites from "../utils/RequirementSites";
import type IRecordedRequirement from "../transpiler/types/IRecordedRequirement";
import type IRequirementSite from "../transpiler/types/IRequirementSite";
import type TRequirementKey from "../transpiler/types/TRequirementKey";

class ToolchainRequirements {
  /** Requirements the emitted text actually carries, with every site. */
  private static recorded: Map<TRequirementKey, IRequirementSite[]> = new Map();

  /**
   * Source sites for emissions DEFERRED to assembleGeneratedOutput -- clamp
   * helpers, IRQ wrappers, float asserts. Keyed by the request that triggered
   * the deferral ("irq_wrappers", "float_static_assert").
   *
   * Kept separate from `recorded` because at request time the code has not been
   * emitted yet, so there is nothing to record a requirement for. The emitter
   * claims these sites when it actually produces the block.
   */
  private static deferred: Map<string, IRequirementSite[]> = new Map();

  /**
   * THE recording sink for toolchain requirements.
   *
   * Every requirement, from every transport -- generator effects, the include
   * funnel, and direct calls from static helpers -- lands here. Call it from
   * the branch that emits the text, never from a caller that infers which
   * branch ran.
   */
  static record(
    key: TRequirementKey,
    sites: readonly IRequirementSite[] = [],
  ): void {
    const existing = this.recorded.get(key);
    if (existing === undefined) {
      this.recorded.set(key, [...sites]);
      return;
    }
    for (const site of sites) {
      RequirementSites.addUnique(existing, site);
    }
  }

  /**
   * Note where a deferred emission was requested, so the emitter can attribute
   * it once it actually produces the block.
   */
  static noteDeferredSite(
    requestKey: string,
    sourcePath: string,
    line: number | null,
  ): void {
    const site: IRequirementSite = { sourcePath, line };
    const existing = this.deferred.get(requestKey);
    if (existing === undefined) {
      this.deferred.set(requestKey, [site]);
      return;
    }
    RequirementSites.addUnique(existing, site);
  }

  /** Sites recorded for a deferred emission. */
  static takeDeferredSites(requestKey: string): readonly IRequirementSite[] {
    return this.deferred.get(requestKey) ?? [];
  }

  /**
   * Snapshot what this file's generated output requires.
   *
   * Must be read before the next file's reset, which clears the recording map.
   */
  static collect(): readonly IRecordedRequirement[] {
    return Array.from(this.recorded.entries()).map(([key, sites]) => ({
      key,
      sites: [...sites],
    }));
  }

  /**
   * Both maps MUST be cleared per file: leaking them makes a project report
   * attribute one file's CMSIS or C11 cost to every later file.
   */
  static reset(): void {
    this.recorded = new Map();
    this.deferred = new Map();
  }
}

export default ToolchainRequirements;
