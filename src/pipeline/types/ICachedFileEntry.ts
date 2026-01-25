/**
 * Cached entry for a single header file
 */

import IStructFieldInfo from "../../symbol_resolution/types/IStructFieldInfo";
import ISerializedSymbol from "./ISerializedSymbol";

interface ICachedFileEntry {
  /** Absolute path to the header file */
  filePath: string;
  /** Cache key for invalidation (format: "mtime:<timestamp>" or future "hash:<sha256>") */
  cacheKey: string;
  /** Symbols extracted from this file */
  symbols: ISerializedSymbol[];
  /** Struct fields: struct name -> (field name -> field info) */
  structFields: Record<string, Record<string, IStructFieldInfo>>;
  /** Issue #196 Bug 3: Struct names requiring 'struct' keyword in C */
  needsStructKeyword?: string[];
  /** Issue #208: Enum bit widths from typed enums (enum name -> bit width) */
  enumBitWidth?: Record<string, number>;
}

export default ICachedFileEntry;
