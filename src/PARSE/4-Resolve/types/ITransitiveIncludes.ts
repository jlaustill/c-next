import type ICodeGenSymbols from "../../../transpiler/types/ICodeGenSymbols";

/**
 * One file's include closure, walked once (#1472).
 *
 * The walk used to yield only `ICodeGenSymbols`, so a caller wanting any OTHER
 * per-file fact about the same closure had no way to ask for it — the file a
 * given `ICodeGenSymbols` came from is not recoverable from the value, and
 * `ICodeGenSymbols` is a codegen-shaped view rather than a key. The only route
 * left was a second traversal of the same include tree.
 *
 * `paths` was added so the ADR-057 seed could be read from Declare's own
 * artifact; #1472 then took that seed out of Declare. 1.4 reads both halves:
 * `Program.deriveVisibleSymbols` reads `sources`, and the scope types each file
 * can see are joined against `paths` (#1724) -- in a walk of their own, because
 * those scope types settle the symbols `sources` is built from.
 * Since #1435 the closure is taken in memory over the include graph discovery
 * resolved, not re-read from disk: the retained graph
 * `docs/architecture/symbol-view-scopes.md` names as the change that brings a
 * derived symbol view under its cost ceiling.
 */
interface ITransitiveIncludes {
  /**
   * `ICodeGenSymbols` for each visited file that has them, in visit order.
   *
   * Shorter than `paths` only when the graph names a file with no symbol
   * info. A run's graph cannot -- every file in it is declared, or the run
   * stops before 1.4 -- so only a graph built by hand (a unit test) can.
   */
  readonly sources: ReadonlyArray<ICodeGenSymbols>;

  /**
   * Every file the walk visited, in visit order, under the path the run
   * declared it with -- not always resolved: a source run's root keeps the
   * `sourcePath` it was given. The file the walk started from is never in it.
   *
   * This is the key `sources` cannot supply. A caller holding a per-file map of
   * any other fact joins against these.
   */
  readonly paths: ReadonlyArray<string>;
}

export default ITransitiveIncludes;
