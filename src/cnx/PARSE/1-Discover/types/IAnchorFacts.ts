/**
 * The facts of where a run is anchored (#1719), with none of the services the
 * anchor also picks.
 *
 * #1444 review: the `SourceGraph` carried these as a `Pick` of `IRunAnchor`,
 * and `IRunAnchor` names `PathResolver` and `Preprocessor`. A type-only import
 * is still an edge to dependency-cruiser, so a later pass importing the
 * artifact reached 1.1's services, and `nothing-after-1-1-discovers` reported
 * 21 errors for a read that §1 allows. The artifact names this, and
 * `IRunAnchor` extends it.
 */
interface IAnchorFacts {
  /**
   * The directory a `.cnx` header's `#include` is measured from, and the
   * include guard's base when no project root is found.
   */
  readonly directory: string;

  /** The project root found by walking up from the anchor, if any. */
  readonly projectRoot: string | undefined;

  /** The compile database's defines beneath the caller's, which win. */
  readonly defines: Readonly<Record<string, string | boolean>>;
}

export default IAnchorFacts;
