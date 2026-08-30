/**
 * Why an item was given the release it was given -- or why it was not.
 *
 * The reason is what separates an answer this script owns from one it merely
 * has an opinion about. Only `shipped` and `not-planned` are written; the other
 * two are referrals, because overwriting a human's answer with "I do not know"
 * is worse than leaving it alone. See `ReleaseAttribution.owns()`.
 */
type TAttributionReason =
  /** A closing merge commit lands in a known release window. */
  | "shipped"
  /** Closed `not_planned`: nothing shipped, so no release names it. */
  | "not-planned"
  /**
   * A closing merge commit exists but is on no tag and not on the branch --
   * a pull request merged into a stack that never landed. GitHub reports it
   * as `MERGED`; `git merge-base --is-ancestor` reports it as unshipped.
   */
  | "not-shipped"
  /** Closed by hand with no linked commit or pull request. A human decides. */
  | "underivable";

export default TAttributionReason;
