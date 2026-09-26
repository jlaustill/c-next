/**
 * ADR-010 facts about the file under analysis, supplied by the caller.
 *
 * #1322: none of these may be read off shared state at analyzer time.
 * `CodeGenState.sourcePath` is written inside `CodeGenerator.generate()`, which
 * runs after the analyzers -- measured, it is `null` for the first file of a run
 * and holds the PREVIOUS file's path for every file after, so a rule reading it
 * would be order-dependent (#1399). The search path cannot be re-derived at all
 * without losing the `--include` directories discovery had. And the existence
 * oracle is the run's own file-system abstraction, so a source-mode run and a
 * unit test answer the same way a files-mode run does.
 */
interface IIncludeContext {
  /**
   * The directory a quoted include from this file resolves from, as DISCOVERY
   * resolved it (#1435). Handed in rather than taken as `dirname` of the
   * file's path: a source run's in-memory root may have no path, or a
   * relative one its `workingDir` resolves, and a second derivation here
   * disagreed with discovery about which quoted includes exist.
   */
  readonly quotedIncludeDirectory: string;

  /**
   * Directories an angle include is searched along, in priority order, as
   * DISCOVERY built them. Never re-derived: see `IDiscoveryFacts` for what
   * re-deriving cost, and for why the list is frozen onto the program artifact
   * rather than read from a mutable accumulator (#1452).
   */
  readonly searchPaths: readonly string[];

  /** Whether a path exists, through the run's file system. */
  readonly fileExists: (path: string) => boolean;
}

export default IIncludeContext;
