/**
 * Struct field information
 */
interface IStructFieldInfo {
  /** Field type (e.g., "uint32_t", "uint16_t") */
  type: string;
  /** Array dimensions if field is an array - numbers for resolved dimensions, strings for macros */
  arrayDimensions?: (number | string)[];
}

export default IStructFieldInfo;
