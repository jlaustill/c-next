/**
 * What 1.4 Resolve needs to work out which files each file can see.
 *
 * The include closure is walked from disk, so the search path travels with it.
 * `cnextIncludesByFile` carries an entry only for a file whose includes were
 * STATED rather than discovered — a standalone run supplies them — and its
 * presence is what selects the walker, so an empty array is meaningfully
 * different from an absent one.
 */
interface IVisibilityInput {
  readonly includeDirs: readonly string[];
  readonly cnextIncludesByFile: ReadonlyMap<
    string,
    ReadonlyArray<{ path: string }>
  >;
}

export default IVisibilityInput;
