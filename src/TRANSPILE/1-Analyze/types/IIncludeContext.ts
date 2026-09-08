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
  /** Absolute path of the file being analyzed. */
  readonly sourcePath: string;

  /**
   * Directories an angle include is searched along, in priority order, as
   * DISCOVERY built them. Never re-derived: see
   * `TranspilerState.getIncludeSearchPaths` for what re-deriving cost.
   */
  readonly searchPaths: readonly string[];

  /** Whether a path exists, through the run's file system. */
  readonly fileExists: (path: string) => boolean;
}

export default IIncludeContext;
