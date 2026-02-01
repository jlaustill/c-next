/**
 * Types of symbols that can be collected from source files
 */
enum ESymbolKind {
  Function = "function",
  Variable = "variable",
  Type = "type",
  Namespace = "namespace",
  Class = "class",
  Struct = "struct",
  Enum = "enum",
  EnumMember = "enum_member",
  Bitmap = "bitmap",
  BitmapField = "bitmap_field",
  Register = "register",
  RegisterMember = "register_member",
}

export default ESymbolKind;
