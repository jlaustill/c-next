/**
 * C-Next configuration file options
 *
 * This interface represents the structure of cnext.config.json,
 * .cnext.json, or .cnextrc files.
 */
interface IFileConfig {
  /** Issue #211: Force C++ output. Auto-detection may also enable this. */
  cppRequired?: boolean;
  /** Generate panic-on-overflow helpers */
  debugMode?: boolean;
  /** ADR-049: Target platform (e.g., "teensy41", "cortex-m0") */
  target?: string;
  /** Disable symbol caching (.cnx/ directory) */
  noCache?: boolean;
  /** Additional include directories for C/C++ header discovery */
  include?: string[];
  /** Output directory for generated files */
  output?: string;
  /** Separate output directory for header files */
  headerOut?: string;
  /** Base path to strip from header output paths (only used with headerOut) */
  basePath?: string;
  /** Internal: path to config file that was loaded (set by ConfigLoader) */
  _path?: string;
}

export default IFileConfig;
