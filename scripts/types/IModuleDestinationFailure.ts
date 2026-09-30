/**
 * Why `npm run destinations:check` failed, for one module, row or baseline entry.
 */
interface IModuleDestinationFailure {
  readonly kind:
    | "unresolvable-row"
    | "no-row"
    | "unmatched-row"
    | "awaiting-grew"
    | "baseline-stale";
  /** The module path, or the row's pattern. */
  readonly subject: string;
  /** 1-based line in the map, or null when the subject is not a row. */
  readonly line: number | null;
}

export default IModuleDestinationFailure;
