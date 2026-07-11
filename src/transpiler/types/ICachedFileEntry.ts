/**
 * Cached entry for a single header file
 */

import IStructFieldInfo from "./symbols/IStructFieldInfo";
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
  /** Issue #948: Opaque types (forward-declared struct types) */
  opaqueTypes?: string[];
  /** Issue #958: Typedef struct types with source files ([typeName, sourceFile] pairs) */
  typedefStructTypes?: Array<[string, string]>;
  /** Issue #958: Struct tag → typedef name aliases ([structTag, typedefName] pairs) */
  structTagAliases?: Array<[string, string]>;
  /** Issue #958: Struct tags that have full definitions (bodies) */
  structTagsWithBodies?: string[];
  /**
   * Issue #985: This header could not be preprocessed standalone and fell back
   * to raw content, so its cached symbols are degraded (phantom struct bodies,
   * missing/by-value framework signatures). Persisted so a warm-cache build
   * still triggers the external-declaration recovery pass and re-applies the fix.
   */
  preprocessFailed?: boolean;
}

export default ICachedFileEntry;
