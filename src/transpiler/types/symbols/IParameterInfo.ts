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

  /** Array dimensions if this parameter is an array */
  readonly arrayDimensions?: ReadonlyArray<number | string>;
}

export default IParameterInfo;
