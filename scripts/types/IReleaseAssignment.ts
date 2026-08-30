import type TAttributionReason from "./TAttributionReason";

/**
 * What one item's release is, what it currently claims, and how that was decided.
 *
 * `derived` is `null` for every reason but `shipped`. Whether that null should
 * be written is not recorded here -- `ReleaseAttribution.owns()` answers it in
 * one place, so a caller cannot re-derive the consequence and disagree.
 */
interface IReleaseAssignment {
  readonly number: number;
  readonly kind: "issue" | "pull request";
  readonly current: string | null;
  readonly derived: string | null;
  readonly reason: TAttributionReason;
}

export default IReleaseAssignment;
