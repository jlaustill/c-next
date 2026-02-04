/**
 * Symbol kind for IDE features
 * Note: C-Next doesn't have classes - uses scopes/structs instead
 */
type TSymbolKind =
  | "namespace"
  | "struct"
  | "register"
  | "function"
  | "variable"
  | "registerMember"
  | "field"
  | "method";

export default TSymbolKind;
