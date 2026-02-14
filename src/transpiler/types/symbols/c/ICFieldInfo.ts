/**
 * Metadata for a C struct field.
 * Uses simple strings for types since C types pass through unchanged.
 */
interface ICFieldInfo {
  /** Field name */
  readonly name: string;

  /** Field type as string (e.g., "int", "char*") */
  readonly type: string;

  /** Array dimensions if this field is an array */
  readonly arrayDimensions?: ReadonlyArray<number>;
}

export default ICFieldInfo;
