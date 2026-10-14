/**
 * Serialized struct field information for caching.
 * Uses string types instead of TType for JSON serialization.
 */
interface IStructFieldInfo {
  /** Field type (e.g., "uint32_t", "uint16_t") */
  type: string;
  /** Array dimensions if field is an array - numbers for resolved dimensions, strings for macros */
  arrayDimensions?: (number | string)[];
  /**
   * #1975 review: a field whose struct does not lay its fields' bits end to
   * end -- a union's, which share them, or one of a struct C packs bit-fields
   * (`a : 3`) into -- so the struct's length is not its fields' sum
   */
  layout?: "union-member" | "bit-packed";
}

export default IStructFieldInfo;
