/**
 * Read-only symbol collections for code generation.
 * Provides generators with access to type declarations without mutation.
 *
 * This interface mirrors the readonly accessors of SymbolCollector,
 * enabling dependency injection and testing.
 */
interface ICodeGenSymbols {
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

  /** Bit width for each bitmap: bitmapName -> bitWidth (e.g., 8, 16, 24, 32) */
  readonly bitmapBitWidth: ReadonlyMap<string, number>;

  // === Register Information (ADR-004) ===

  /** Scoped registers: "scopeName.registerName" -> address expression */
  readonly scopedRegisters: ReadonlyMap<string, string>;

  /** Register member access patterns: "scope.reg.field" -> access code */
  readonly registerMemberAccess: ReadonlyMap<string, string>;

  /** Register member types: "scope.reg.field" -> typeName */
  readonly registerMemberTypes: ReadonlyMap<string, string>;

  // Issue #187: Register address info for width-appropriate memory access
  /** Register base addresses: registerName -> base address expression */
  readonly registerBaseAddresses: ReadonlyMap<string, string>;

  /** Register member offsets: "reg_member" -> offset expression */
  readonly registerMemberOffsets: ReadonlyMap<string, string>;

  /** Register member C types: "reg_member" -> C type (e.g., "uint32_t") */
  readonly registerMemberCTypes: ReadonlyMap<string, string>;

  // === Issue #232: Scope Variable Usage Analysis ===

  /**
   * Scope variable usage: "Scope_varName" -> Set of function names that use it.
   * Used to determine if a variable is single-function (can be local).
   */
  readonly scopeVariableUsage: ReadonlyMap<string, ReadonlySet<string>>;

  // === Issue #282: Scope Private Const Inlining ===

  /**
   * Private const values for inlining: "Scope_constName" -> literal value string.
   * Used to inline private const values at usage sites.
   */
  readonly scopePrivateConstValues: ReadonlyMap<string, string>;

  // === Function Return Types ===

  /**
   * Function return types: "functionName" -> return type string.
   * Used to determine enum types for function call expressions.
   * Keys are full function names (e.g., "Motor_getMode" for scope methods, "getState" for globals).
   */
  readonly functionReturnTypes: ReadonlyMap<string, string>;

  // === Opaque Types (Issue #948) ===

  /**
   * Issue #948: Types that are opaque (forward-declared structs).
   * Variables of these types should be generated as pointers.
   */
  readonly opaqueTypes: ReadonlySet<string>;

  /**
   * Check if a scope variable is used in only one function.
   * Returns the function name if single-function, null otherwise.
   */
  getSingleFunctionForVariable(
    scopeName: string,
    varName: string,
  ): string | null;

  /**
   * Check if any scope members are public (exported).
   * Used to determine if a self-include header is needed for extern "C" linkage.
   */
  hasPublicSymbols(): boolean;
}

export default ICodeGenSymbols;
