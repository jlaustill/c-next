/**
 * Symbol kinds for C-Next language constructs.
 */
type TSymbolKindCNext =
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

export default TSymbolKindCNext;
