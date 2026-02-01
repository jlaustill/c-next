import ICodeGenSymbols from "../../../types/ICodeGenSymbols";

/**
 * Options for the code generator
 */
interface ICodeGeneratorOptions {
  /** ADR-044: When true, generate panic helpers instead of clamp helpers */
  debugMode?: boolean;
  /**
   * ADR-055: Pre-collected symbol info from CNextResolver + TSymbolInfoAdapter.
   * When provided, CodeGenerator uses this instead of creating SymbolCollector.
   */
  symbolInfo?: ICodeGenSymbols;
  /** ADR-049: CLI/config target override (takes priority over #pragma target) */
  target?: string;
  /** ADR-010: Source file path for validating includes */
  sourcePath?: string;
  /**
   * Issue #250: When true, generate C++ compatible code.
   * Uses temporary variables instead of compound literals for rvalue pointer params.
   */
  cppMode?: boolean;
  /**
   * Issue #339: Relative path from source root to source file for self-include.
   * When set, self-includes will use this relative path instead of just the basename.
   * Example: "Display/Utils.cnx" -> #include "Display/Utils.h"
   */
  sourceRelativePath?: string;
  /**
   * Issue #349: Include directories for resolving angle-bracket .cnx includes.
   * Used to search for .cnx files referenced in #include <file.cnx> directives.
   */
  includeDirs?: string[];
  /**
   * Issue #349: Input directories for calculating relative paths.
   * Used to determine the correct output path prefix for headers.
   */
  inputs?: string[];
}

export default ICodeGeneratorOptions;
