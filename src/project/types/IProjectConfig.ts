/**
 * Configuration for a C-Next project
 */
interface IProjectConfig {
  /** Project name */
  name?: string;

  /** Source directories to scan for .cnx files */
  srcDirs: string[];

  /** Include directories for C/C++ headers */
  includeDirs: string[];

  /** Output directory for generated files */
  outDir: string;

  /** Separate output directory for header files (defaults to outDir) */
  headerOutDir?: string;

  /** Base path to strip from header output paths (only used with headerOutDir) */
  basePath?: string;

  /** Specific files to compile (overrides srcDirs) */
  files?: string[];

  /** File extensions to process (default: ['.cnx']) */
  extensions?: string[];

  /** Whether to preprocess C/C++ files */
  preprocess?: boolean;

  /** Additional preprocessor defines */
  defines?: Record<string, string | boolean>;

  /** Issue #211: Force C++ output. Auto-detection may also enable this. */
  cppRequired?: boolean;

  /** Issue #183: Disable symbol caching (default: false = cache enabled) */
  noCache?: boolean;

  /** Parse only mode - validate syntax without generating output */
  parseOnly?: boolean;
}

export default IProjectConfig;
