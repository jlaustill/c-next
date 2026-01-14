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
}

export default ICodeGeneratorOptions;
