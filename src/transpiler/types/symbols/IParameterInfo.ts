import type TType from "../TType";

/**
 * Metadata for a function parameter.
 */
interface IParameterInfo {
  /** Parameter name */
  readonly name: string;

  /** Parameter type */
  readonly type: TType;

  /** Whether this parameter is const */
  readonly isConst: boolean;

  /** Whether this parameter is an array */
  readonly isArray: boolean;

  /** Array dimensions if isArray is true */
  readonly arrayDimensions?: ReadonlyArray<number | string>;

  /** Issue #268: true if parameter should get auto-const (unmodified pointer) */
  readonly isAutoConst?: boolean;
}

export default IParameterInfo;
