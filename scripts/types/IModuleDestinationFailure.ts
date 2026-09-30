/**
 * Why `npm run destinations:check` failed, for one module, row or baseline entry.
 */
interface IModuleDestinationFailure {
  readonly kind:
    | "unresolvable-row"
    | "no-row"
    | "conflicting-rows"
    | "unmatched-row"
    | "awaiting-grew"
    | "baseline-stale";
  /** The module path, or the row's pattern. */
  readonly subject: string;
  /** 1-based line in the map, or null when the subject is not a row. */
  readonly line: number | null;
  /** For the ratchet: the module count against what `AWAITING_ROWS` holds. */
  readonly detail?: string;
}

export default IModuleDestinationFailure;
