/**
 * ADR-010 facts about the file under analysis: 1.1 Discover's answers, read
 * rather than re-derived (#1672).
 *
 * Both maps are keyed by `IncludeDiscovery.directiveText`. #1322 and #1435
 * handed this pass discovery's INPUTS instead -- the search path, the
 * quoted-include directory and a file-exists oracle -- and it made its own
 * decision with them, along its own branch between the two forms. That
 * decision missed an absolute angle include discovery resolves, and asked the
 * file system a second time, so the two could answer differently.
 */
interface IIncludeContext {
  /** The file each directive resolved to, or null: E0506's question. */
  readonly resolutions: ReadonlyMap<string, string | null>;

  /**
   * For each include of a header whose C-Next source the same form of include
   * would find, that source's spelling: E0504's question. An include with no
   * entry has none.
   */
  readonly cnextAlternatives: ReadonlyMap<string, string>;
}

export default IIncludeContext;
