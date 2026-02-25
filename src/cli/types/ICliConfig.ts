/**
 * Merged CLI + file configuration for the transpiler
 *
 * This represents the final effective configuration after merging
 * CLI flags with config file settings. CLI flags take precedence.
 */
interface ICliConfig {
  /** Entry point .cnx file to transpile */
  input: string;
  /** Output path (file or directory) */
  outputPath: string;
  /** Additional include directories */
  includeDirs: string[];
  /** Preprocessor defines */
  defines: Record<string, string | boolean>;
  /** Whether to run C preprocessor on headers */
  preprocess: boolean;
  /** --verbose flag */
  verbose: boolean;
  /** Force C++ output */
  cppRequired: boolean;
  /** Disable symbol caching */
  noCache: boolean;
  /** Parse only mode */
  parseOnly: boolean;
  /** Separate output directory for headers */
  headerOutDir?: string;
  /** Base path to strip from header output paths */
  basePath?: string;
  /** Target platform for atomic code generation */
  target?: string;
  /** Generate panic-on-overflow helpers */
  debugMode?: boolean;
}

export default ICliConfig;
