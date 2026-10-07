/**
 * #1844: one preprocessor run, as `PreprocessCache` keeps it -- what the
 * compiler printed, and every file it read, each with the mtime it had then.
 */
interface IPreprocessCacheEntry {
  readonly stdout: string;
  readonly stderr: string;
  /** Why the run failed, or null when it succeeded */
  readonly error: string | null;
  /** The compiler's dependency output (`-MD`), as `[path, mtimeMs]` pairs */
  readonly deps: readonly (readonly [string, number])[];
  /**
   * Where a file added would be found ahead of one in `deps` -- the same name
   * in an earlier directory of its search path. None of them existed.
   */
  readonly absent: readonly string[];
}

export default IPreprocessCacheEntry;
