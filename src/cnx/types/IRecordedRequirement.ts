import type IRequirementSite from "./IRequirementSite";
import type TRequirementKey from "./TRequirementKey";

/**
 * Issue #1143: A requirement that generated output actually carries, together
 * with every source location that incurred it.
 *
 * Decided by 2.2 Plan, from the planned block that decided the text (#1928) or
 * the form Render reported emitting (#1997), so a consumer can never disagree
 * with what was emitted. The sites are attribution only.
 */
interface IRecordedRequirement {
  /** Registry key; look up the details in TOOLCHAIN_REQUIREMENTS. */
  readonly key: TRequirementKey;

  /** Source locations that incurred it. May be empty. */
  readonly sites: readonly IRequirementSite[];
}

export default IRecordedRequirement;
