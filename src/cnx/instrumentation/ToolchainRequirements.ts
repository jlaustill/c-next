/**
 * Issue #1143: where each toolchain requirement of one file was asked for.
 *
 * Sites only, never keys. 2.2 Plan decides every requirement key -- the
 * planned blocks' own (#1928) and what each form Render emits costs (#1997) --
 * and carries these sites beside them as attribution. Render reports the forms
 * it emitted; it records no requirement, which is §1's Ownership table:
 * toolchain requirements are 2.2's. The file's one list is
 * `CodeGenerator.getToolchainRequirements()`, read off the plan.
 *
 * PR #1141 failed by re-deriving -- its `#error` guard keyed on
 * `usedClampOps.size > 0` while the emission it described keyed on the template
 * family, so 96 snapshots shipped a guard for a builtin they did not contain.
 * Each requirement is now decided once, from the same facts its emission reads.
 *
 * ## Why this is instrumentation (#1452)
 *
 * A site is a fact ABOUT the run's output, not a fact the run computes in order
 * to decide anything. Both consumers are self-report: the banner comment on the
 * `.c`/`.cpp`, and `ITranspilerResult.requirements`. No branch anywhere reads a
 * site to choose what to emit -- the `needs*` and `emitted*` facts decide that,
 * and the sites travel alongside as attribution.
 *
 * ## What this does NOT need, and AdrProvenance does
 *
 * [[AdrProvenance]] sits here under a stated exemption from box 4: it is
 * genuinely cross-pass, written at 17 `record` sites spanning 2.1 Analyze and
 * 2.3 Render and read once at the end of the run. This module claims no such
 * exemption, because it is not cross-pass state at all. Every write is inside
 * 2.2 Plan's walk -- `TranspileState.requireInclude` and
 * `TranspileState.noteLdrexStrexLoop` -- and every read is `takeDeferredSites` in
 * `planEmissionFacts`, inside the same `plan()` call for the same file.
 *
 * Do not read its presence in this root as a precedent for parking cross-pass
 * state here to get out from under `passes-hold-no-mutable-state.test.ts` --
 * the paragraph above is the claim, and it is the thing to re-measure if a
 * write site is ever added from an earlier pass.
 */
import RequirementSites from "../utils/RequirementSites";
import type IRequirementSite from "../types/IRequirementSite";
import type TDeferredSiteKey from "../types/TDeferredSiteKey";

class ToolchainRequirements {
  /**
   * Sites that asked for a plan-decided emission, keyed by the request.
   * `planEmissionFacts` takes these into `IEmissionFacts`, and the plan
   * carries them as its requirements' sites (#1928, #1997).
   */
  private static deferred: Map<TDeferredSiteKey, IRequirementSite[]> =
    new Map();

  /**
   * Note where a plan-decided emission was requested, so the plan can
   * attribute its requirement.
   */
  static noteDeferredSite(
    requestKey: TDeferredSiteKey,
    sourcePath: string,
    line: number | null,
  ): void {
    RequirementSites.accumulate(this.deferred, requestKey, [
      { sourcePath, line },
    ]);
  }

  /** Sites recorded for a deferred emission. */
  static takeDeferredSites(
    requestKey: TDeferredSiteKey,
  ): readonly IRequirementSite[] {
    return this.deferred.get(requestKey) ?? [];
  }

  /**
   * MUST be cleared per file: leaking it makes a project report attribute one
   * file's CMSIS or C11 cost to every later file.
   */
  static reset(): void {
    this.deferred = new Map();
  }
}

export default ToolchainRequirements;
