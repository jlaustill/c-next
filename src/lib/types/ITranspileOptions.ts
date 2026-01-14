/**
 * Options for transpilation
 */
interface ITranspileOptions {
  /** Parse only, don't generate code */
  parseOnly?: boolean;
  /** ADR-044: When true, generate panic-on-overflow helpers instead of clamp helpers */
  debugMode?: boolean;
  /** ADR-049: Target platform for atomic code generation (e.g., "teensy41", "cortex-m0") */
  target?: string;
}

export default ITranspileOptions;
