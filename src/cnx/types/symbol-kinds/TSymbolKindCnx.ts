/**
 * Symbol kinds for cnx language constructs.
 */
type TSymbolKindCnx =
  | "function"
  | "variable"
  | "struct"
  | "struct_field"
  | "enum"
  | "enum_member"
  | "bitmap"
  | "bitmap_field"
  | "register"
  | "register_member"
  | "scope";

export default TSymbolKindCnx;
