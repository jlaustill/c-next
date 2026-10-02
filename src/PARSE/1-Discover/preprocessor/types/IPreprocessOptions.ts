import IToolchain from "./IToolchain";

/**
 * Preprocessor options
 */
interface IPreprocessOptions {
  /** Additional include paths */
  includePaths?: string[];

  /** Preprocessor defines (-D flags) */
  defines?: Record<string, string | boolean>;

  /** Specific toolchain to use (auto-detect if not specified) */
  toolchain?: IToolchain;

  /** Keep #line directives for source mapping (default: true) */
  keepLineDirectives?: boolean;

  /**
   * Headers whose macros to import before preprocessing the target file
   * (gcc/clang `-imacros`), in order. Supplies include-order macro context so a
   * header that requires a predecessor can preprocess — e.g. FreeRTOS `task.h`
   * needs `INC_FREERTOS_H` and attribute macros defined by `FreeRTOS.h` first.
   * Unlike `-include`, `-imacros` keeps only the predecessors' macros, not their
   * declarations, so the output stays scoped to the target file.
   */
  imacros?: string[];

  /**
   * Dump macro definitions (gcc/clang `-dM`) instead of preprocessed source.
   * Output is the `#define` list, used to discover function-like macros (e.g.
   * FreeRTOS `pdMS_TO_TICKS`) that a plain preprocess consumes at use sites.
   */
  dumpMacros?: boolean;
}

export default IPreprocessOptions;
