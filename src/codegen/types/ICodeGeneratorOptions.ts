/**
 * Options for the code generator
 */
interface ICodeGeneratorOptions {
  /** ADR-044: When true, generate panic helpers instead of clamp helpers */
  debugMode?: boolean;
  /** ADR-049: CLI/config target override (takes priority over #pragma target) */
  target?: string;
  /** ADR-010: Source file path for validating includes */
  sourcePath?: string;
  /**
   * Issue #230: When true, emit self-include for extern "C" linkage.
   * Only set this when headers will actually be generated alongside the implementation.
   */
  generateHeaders?: boolean;
  /**
   * Issue #250: When true, generate C++ compatible code.
   * Uses temporary variables instead of compound literals for rvalue pointer params.
   */
  cppMode?: boolean;
}

export default ICodeGeneratorOptions;
