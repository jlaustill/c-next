/**
 * Cached entry for a single header file
 */

import IStructFieldInfo from "../../symbols/types/IStructFieldInfo";
import ISerializedSymbol from "./ISerializedSymbol";

interface ICachedFileEntry {
  /** Absolute path to the header file */
  filePath: string;
  /** File modification time (ms since epoch) */
  mtime: number;
  /** Symbols extracted from this file */
  symbols: ISerializedSymbol[];
  /** Struct fields: struct name -> (field name -> field info) */
  structFields: Record<string, Record<string, IStructFieldInfo>>;
}

export default ICachedFileEntry;
