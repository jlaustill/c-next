/**
 * Metadata for a C struct field.
 * Uses simple strings for types since C types pass through unchanged.
 */
interface ICFieldInfo {
  /** Field name */
  readonly name: string;

  /** Field type as string (e.g., "int", "char*") */
  readonly type: string;

  /**
   * Array dimensions if this field is an array.
   * Issue #981: Numbers for resolved dimensions, strings for macro names.
   * Example: [8] for numeric, ["BUF_SIZE"] for macro-sized.
   */
  readonly arrayDimensions?: ReadonlyArray<number | string>;

  /**
   * A bit-field's declared width, `uint32_t a : 3`: a number, or the
   * expression as written when it is no integer literal (#1975 review)
   */
  readonly bitWidth?: number | string;
}

export default ICFieldInfo;
