/**
 * The config a run reads in one directory (#2165): the first config file
 * that could be read and is not empty, and each one passed because it could
 * not be read, for the caller to warn about.
 */
interface IConfigRead {
  readonly config: { readonly path: string; readonly content: string } | null;
  /** Each file passed, and why, as its one rendering for every caller. */
  readonly unreadable: readonly {
    readonly path: string;
    readonly reason: string;
  }[];
}

export default IConfigRead;
