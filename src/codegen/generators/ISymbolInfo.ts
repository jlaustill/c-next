/**
 * Read-only symbol information extracted from SymbolCollector.
 * Provides generators with access to type declarations without mutation.
 *
 * This interface mirrors the readonly accessors of SymbolCollector,
 * enabling dependency injection and testing.
 */

/**
 * Read-only symbol information for code generation
 */
interface ISymbolInfo {
  // === Known Type Names ===

  /** Set of known scope names (ADR-016) */
  readonly knownScopes: ReadonlySet<string>;

  /** Set of known struct type names */
  readonly knownStructs: ReadonlySet<string>;

  /** Set of known register names (ADR-004) */
  readonly knownRegisters: ReadonlySet<string>;

  /** Set of known enum type names (ADR-017) */
  readonly knownEnums: ReadonlySet<string>;

  /** Set of known bitmap type names (ADR-034) */
  readonly knownBitmaps: ReadonlySet<string>;

  // === Scope Information ===

  /** Members of each scope: scopeName -> Set of member names */
  readonly scopeMembers: ReadonlyMap<string, ReadonlySet<string>>;

  /** Visibility of scope members: scopeName -> (memberName -> visibility) */
  readonly scopeMemberVisibility: ReadonlyMap<
    string,
    ReadonlyMap<string, "public" | "private">
  >;

  // === Struct Information ===

  /** Struct field types: structName -> (fieldName -> typeName) */
  readonly structFields: ReadonlyMap<string, ReadonlyMap<string, string>>;

  /** Fields that are arrays: structName -> Set of array field names */
  readonly structFieldArrays: ReadonlyMap<string, ReadonlySet<string>>;

  /** Array dimensions for struct fields: structName -> (fieldName -> dimensions) */
  readonly structFieldDimensions: ReadonlyMap<
    string,
    ReadonlyMap<string, readonly number[]>
  >;

  // === Enum Information (ADR-017) ===

  /** Enum members and values: enumName -> (memberName -> value) */
  readonly enumMembers: ReadonlyMap<string, ReadonlyMap<string, number>>;

  // === Bitmap Information (ADR-034) ===

  /** Bitmap field info: bitmapName -> (fieldName -> {offset, width}) */
  readonly bitmapFields: ReadonlyMap<
    string,
    ReadonlyMap<string, { readonly offset: number; readonly width: number }>
  >;

  /** Backing type for each bitmap: bitmapName -> typeName (e.g., "uint8_t") */
  readonly bitmapBackingType: ReadonlyMap<string, string>;

  // === Register Information (ADR-004) ===

  /** Scoped registers: "scopeName.registerName" -> address expression */
  readonly scopedRegisters: ReadonlyMap<string, string>;

  /** Register member access patterns: "scope.reg.field" -> access code */
  readonly registerMemberAccess: ReadonlyMap<string, string>;

  /** Register member types: "scope.reg.field" -> typeName */
  readonly registerMemberTypes: ReadonlyMap<string, string>;
}

export default ISymbolInfo;
