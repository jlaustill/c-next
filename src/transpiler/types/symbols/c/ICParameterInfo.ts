/**
 * Parameter info for C functions.
 * Uses simple strings for types since C types pass through unchanged.
 */
interface ICParameterInfo {
  /** Parameter name (may be empty for prototypes) */
  readonly name: string;

  /** Parameter type as string (e.g., "int", "const char*") */
  readonly type: string;

  /** Whether this parameter is const */
  readonly isConst: boolean;

  /** Whether this parameter is an array */
  readonly isArray: boolean;
}

export default ICParameterInfo;
