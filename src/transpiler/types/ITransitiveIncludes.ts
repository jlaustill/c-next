import type ICodeGenSymbols from "./ICodeGenSymbols";

/**
 * One file's include closure, walked once (#1472).
 *
 * The walk used to yield only `ICodeGenSymbols`, so a caller wanting any OTHER
 * per-file fact about the same closure had no way to ask for it — the file a
 * given `ICodeGenSymbols` came from is not recoverable from the value, and
 * `ICodeGenSymbols` is a codegen-shaped view rather than a key. The only route
 * left was a second traversal of the same include tree.
 *
 * That mattered because the transpiler already rebuilds this closure repeatedly
 * per file per run, from disk, and `docs/architecture/symbol-view-scopes.md`
 * names retaining it as the single change that brings a derived symbol view
 * under its cost ceiling: "the naive derive is slow for the same reason the
 * transpiler is". Handing back both results from one walk is the small version
 * of that, and it is what lets the ADR-057 seed be read from Declare's own
 * artifact instead of re-derived from the codegen view.
 */
interface ITransitiveIncludes {
  /**
   * `ICodeGenSymbols` for each visited file that has them.
   *
   * Shorter than `paths` whenever a visited file has no symbol info yet — a
   * header, or a file not declared in this run.
   */
  readonly sources: ReadonlyArray<ICodeGenSymbols>;

  /**
   * Every visited file's resolved path, in visit order.
   *
   * This is the key `sources` cannot supply. A caller holding a per-file map of
   * any other fact joins against these.
   */
  readonly paths: ReadonlyArray<string>;
}

export default ITransitiveIncludes;
