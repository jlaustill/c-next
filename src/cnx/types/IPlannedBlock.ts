import type IRequirementSite from "./IRequirementSite";
import type TRequirementKey from "./TRequirementKey";

/**
 * A deferred code block the implementation file must emit, and what its text
 * costs -- decided together.
 *
 * #1143 records a requirement "from the branch that emits the text, never from
 * a caller that infers which branch ran", because a caller that re-derives the
 * branch is free to disagree with it. #1449 moves the decision into 2.2 Plan,
 * which looks like the opposite rule and is not: the guard is against
 * INFERENCE, and a plan does not infer which branch ran -- it decides which
 * branch will run. So `keyword` and `requirements` are fields of one record.
 * They cannot disagree because there is nothing to disagree between, which is
 * strictly stronger than #1143's co-location of the two calls.
 */
interface IPlannedBlock {
  /**
   * The keyword the block renders with, where the block has one. Null when the
   * text is fixed and only the requirements vary by platform.
   */
  readonly keyword: string | null;

  /** Every requirement key this block's text carries. */
  readonly requirements: readonly TRequirementKey[];

  /** Where the block was asked for, for attribution. May be empty. */
  readonly sites: readonly IRequirementSite[];
}

export default IPlannedBlock;
