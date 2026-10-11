/**
 * Metadata for a C++ class/struct field.
 * Uses simple strings for types since C++ types pass through unchanged.
 */
interface ICppFieldInfo {
  /** Field name */
  readonly name: string;

  /** Field type as string (e.g., "int", "std::string") */
  readonly type: string;

  /**
   * Array dimensions if this field is an array.
   * Issue #981: Supports both numeric literals and macro names.
   */
  readonly arrayDimensions?: ReadonlyArray<number | string>;
}

export default ICppFieldInfo;
