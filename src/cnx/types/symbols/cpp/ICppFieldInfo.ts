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

  /**
   * A bit-field's declared width, `uint32_t a : 3`: a number, or the
   * expression as written when it is no integer literal (#1975 review)
   */
  readonly bitWidth?: number | string;
}

export default ICppFieldInfo;
