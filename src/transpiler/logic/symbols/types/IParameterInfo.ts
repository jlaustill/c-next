/**
 * Metadata for a function parameter.
 */
interface IParameterInfo {
  /** Parameter name */
  name: string;

  /** C-Next type (e.g., "u32", "Configuration") */
  type: string;

  /** Whether this parameter is const */
  isConst: boolean;

  /** Whether this parameter is an array */
  isArray: boolean;

  /** Array dimensions if isArray is true (e.g., ["10", "20"] or [""] for unbounded) */
  arrayDimensions?: string[];

  /** Issue #268: true if parameter should get auto-const (unmodified pointer) */
  isAutoConst?: boolean;
}

export default IParameterInfo;
