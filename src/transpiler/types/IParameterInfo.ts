/**
 * C-Next Parameter Information
 *
 * Represents a function parameter with type information using TType.
 * This interface uses the discriminated union TType instead of strings
 * for type-safe parameter handling.
 */
import type TType from "./TType";

/**
 * Parameter information for function signatures
 */
interface IParameterInfo {
  /** Parameter name */
  readonly name: string;

  /** Parameter type using TType discriminated union */
  readonly type: TType;

  /** Whether the parameter is const-qualified */
  readonly isConst: boolean;

  /**
   * Array dimensions if this is an array parameter
   * - Numbers for resolved constant dimensions
   * - Strings for C macro pass-through (e.g., "BUFFER_SIZE")
   * - Undefined if not an array
   */
  readonly arrayDimensions?: ReadonlyArray<number | string>;
}

export default IParameterInfo;
