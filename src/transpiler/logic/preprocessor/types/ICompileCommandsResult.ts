/**
 * The compiler's own view, derived from a `compile_commands.json` compilation
 * database: the include search path, preprocessor defines, and compiler binary.
 */
interface ICompileCommandsResult {
  /** Include search paths (absolute), in first-seen order, de-duplicated. */
  includePaths: string[];
  /** Preprocessor defines: `-D KEY=VAL` -> `VAL`, bare `-D KEY` -> `true`. */
  defines: Record<string, string | boolean>;
  /** The compiler binary (argv[0]) of the entries, or null if none found. */
  compiler: string | null;
}

export default ICompileCommandsResult;
