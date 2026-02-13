import type TType from "../TType";

/**
 * Metadata for a struct field.
 */
interface IFieldInfo {
  /** Field name */
  readonly name: string;

  /** Field type */
  readonly type: TType;

  /** Whether this field is const */
  readonly isConst: boolean;

  /** Whether this field is atomic (volatile in C) */
  readonly isAtomic: boolean;

  /** Whether this field is an array */
  readonly isArray: boolean;

  /** Array dimensions if isArray is true */
  readonly dimensions?: ReadonlyArray<number | string>;
}

export default IFieldInfo;
