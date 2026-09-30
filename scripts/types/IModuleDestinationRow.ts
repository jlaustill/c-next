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
  /**
   * Where an `awaiting` row sends the module: the first `src/` path in its
   * destination cell, or null when it names none (a deletion) or is placed.
   */
  readonly target: string | null;
}

export default IModuleDestinationRow;
