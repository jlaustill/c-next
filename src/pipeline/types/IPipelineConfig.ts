/**
 * Configuration for the unified transpilation pipeline
 *
 * Combines options from IProjectConfig and ITranspileOptions into a single
 * configuration interface that supports both single-file and multi-file builds.
 */
interface IPipelineConfig {
  /** Input paths - files or directories to transpile */
  inputs: string[];

  /** Include directories for C/C++ header discovery */
  includeDirs?: string[];

  /** Output directory for generated files (defaults to same as input) */
  outDir?: string;

  /** Preprocessor defines for C/C++ headers */
  defines?: Record<string, string | boolean>;

  /** Whether to preprocess C/C++ headers (default: true) */
  preprocess?: boolean;

  /** Whether to generate .h files for exported symbols (default: true) */
  generateHeaders?: boolean;

  /** Output file extension (default: ".c") */
  outputExtension?: ".c" | ".cpp";

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

export default IPipelineConfig;
