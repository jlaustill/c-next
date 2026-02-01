/**
 * Metadata for a struct field.
 */
interface IFieldInfo {
  /** C-Next type of the field (e.g., "u32", "Point") */
  type: string;

  /** Whether this field is an array */
  isArray: boolean;

  /** Array dimensions if isArray is true (e.g., [10, 20]) */
  dimensions?: number[];

  /** Whether this field is const */
  isConst: boolean;
}

export default IFieldInfo;
