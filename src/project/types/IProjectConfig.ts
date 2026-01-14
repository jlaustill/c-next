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

  /** Specific files to compile (overrides srcDirs) */
  files?: string[];

  /** File extensions to process (default: ['.cnx']) */
  extensions?: string[];

  /** Whether to generate header files */
  generateHeaders?: boolean;

  /** Whether to preprocess C/C++ files */
  preprocess?: boolean;

  /** Additional preprocessor defines */
  defines?: Record<string, string | boolean>;
}

export default IProjectConfig;
