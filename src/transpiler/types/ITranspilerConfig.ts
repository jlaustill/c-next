/**
 * Configuration for the unified transpiler
 *
 * Combines options from IProjectConfig and ITranspileOptions into a single
 * configuration interface that supports both single-file and multi-file builds.
 */
interface ITranspilerConfig {
  /** Entry point .cnx file to transpile */
  input: string;

  /** Include directories for C/C++ header discovery */
  includeDirs?: string[];

  /** Output directory for generated files (defaults to same as input) */
  outDir?: string;

  /** Separate output directory for header files (defaults to outDir) */
  headerOutDir?: string;

  /** Preprocessor defines for C/C++ headers */
  defines?: Record<string, string | boolean>;

  /** Whether to preprocess C/C++ headers (default: true) */
  preprocess?: boolean;

  /**
   * Issue #211, #1319: emit C++ (`.cpp`/`.hpp`) instead of C. This is THE
   * declaration of the run's output language, not an override of a guess --
   * nothing infers it. A C++ header met in a run that left this false is E0507.
   */
  cppRequired?: boolean;

  /** Parse only mode - no code generation */
  parseOnly?: boolean;

  /** ADR-044: When true, generate panic-on-overflow helpers instead of clamp */
  debugMode?: boolean;

  /** ADR-049: Target platform for atomic code generation */
  target?: string;

  /** Issue #35: Collect grammar rule coverage during parsing */
  collectGrammarCoverage?: boolean;

  /** Issue #183: Disable symbol caching (default: false = cache enabled) */
  noCache?: boolean;
}

export default ITranspilerConfig;
