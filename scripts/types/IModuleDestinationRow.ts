/**
 * One row of `docs/architecture/module-destinations.md`, resolved to the
 * paths under `src/` it places.
 */
interface IModuleDestinationRow {
  /** 1-based line the row sits on. */
  readonly line: number;
  /** Paths or globs rooted at the repository, e.g. `src/PARSE/2-Parse/grammar/**`. */
  readonly patterns: readonly string[];
  /** The issue an `awaiting #NNNN` row names, or null for a placed row. */
  readonly awaiting: number | null;
}

export default IModuleDestinationRow;
