import type IRequirementSite from "./IRequirementSite";
import type TRequirementKey from "./TRequirementKey";

/**
 * Issue #1143: A requirement that generated output actually carries, together
 * with every source location that incurred it.
 *
 * Recorded by the emitter at the moment the text is produced, or carried by the
 * 2.2 plan block that decided the text (#1928), so a consumer can never
 * disagree with what was emitted.
 */
interface IRecordedRequirement {
  /** Registry key; look up the details in TOOLCHAIN_REQUIREMENTS. */
  readonly key: TRequirementKey;

  /** Source locations that incurred it. May be empty. */
  readonly sites: readonly IRequirementSite[];
}

export default IRecordedRequirement;
