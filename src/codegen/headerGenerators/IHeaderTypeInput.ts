import SymbolTable from "../../symbol_resolution/SymbolTable";

/**
 * Input interface for header type generators.
 * Provides read-only access to symbol data needed for generating
 * type definitions in C headers.
 *
 * This interface is a subset of ISymbolInfo, containing only
 * the data needed for generating enums, structs, and bitmaps.
 */
interface IHeaderTypeInput {
  /** Issue #502: Optional SymbolTable for C++ type detection */
  readonly symbolTable?: SymbolTable;
  /** Enum members and values: enumName -> (memberName -> value) */
  readonly enumMembers: ReadonlyMap<string, ReadonlyMap<string, number>>;

  /** Struct field types: structName -> (fieldName -> typeName) */
  readonly structFields: ReadonlyMap<string, ReadonlyMap<string, string>>;

  /** Array dimensions for struct fields: structName -> (fieldName -> dimensions) */
  readonly structFieldDimensions: ReadonlyMap<
    string,
    ReadonlyMap<string, readonly number[]>
  >;

  /** Backing type for each bitmap: bitmapName -> typeName (e.g., "uint8_t") */
  readonly bitmapBackingType: ReadonlyMap<string, string>;

  /** Bitmap field info: bitmapName -> (fieldName -> {offset, width}) */
  readonly bitmapFields: ReadonlyMap<
    string,
    ReadonlyMap<string, { readonly offset: number; readonly width: number }>
  >;
}

export default IHeaderTypeInput;
