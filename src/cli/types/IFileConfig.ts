/**
 * C-Next configuration file options
 *
 * This interface represents the structure of cnext.config.json,
 * .cnext.json, or .cnextrc files.
 */
interface IFileConfig {
  /**
   * Issue #211, #1319, #1844: `true` emits C++ (`.cpp`/`.hpp`); `false` emits
   * C, and a C++ header is then E0507. Unset, a C++ header makes the run C++.
   */
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
  /** Internal: path to config file that was loaded (set by ConfigLoader) */
  _path?: string;
}

export default IFileConfig;
