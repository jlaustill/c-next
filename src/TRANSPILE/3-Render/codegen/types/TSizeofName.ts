/**
 * What a `sizeof` operand's name means where the `sizeof` is, by the binder
 * (#1966): a parameter, a value with the C name every bare identifier emits
 * under (#1967), or no value at all -- a type, enum or scope name, left as
 * written.
 */
type TSizeofName =
  | { readonly kind: "parameter" }
  | { readonly kind: "value"; readonly cName: string }
  | { readonly kind: "none" };

export default TSizeofName;
