/**
 * A C-Next file whose text is supplied rather than read: the root of a
 * `{ kind: "source" }` run.
 *
 * #1435: discovery resolves it with the same loop as every file on disk. Only
 * where its text comes from and which directory it is resolved from differ, so
 * those are the only two things this carries beyond its path.
 */
interface IInMemorySource {
  readonly path: string;
  readonly source: string;
  /**
   * The directory the text is resolved from, standing in for `dirname(path)`:
   * the directory of its path when it has one, else the caller's working
   * directory.
   */
  readonly directory: string;
  /** The caller's own include directories, searched ahead of discovered ones. */
  readonly includeDirs: readonly string[];
}

export default IInMemorySource;
