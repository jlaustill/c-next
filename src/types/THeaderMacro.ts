/**
 * An object-like macro a C or C++ header defines, typed from its replacement
 * tokens (ADR-024, #1688). A floating literal makes it floating when nothing
 * else in the expansion is unreadable -- `typeName` the C type it has, when
 * C-Next names one; a cast or call decides the type whatever it holds. Integer
 * literals, arithmetic and bitwise operators, parentheses and other integer
 * macros, and nothing else, make it integer. Anything else -- a call, a cast,
 * a pointer dereference, a string, a name no header defines -- is unreadable.
 */
type THeaderMacro =
  | { readonly kind: "floating"; readonly typeName: "f32" | "f64" | null }
  | { readonly kind: "integer" }
  | { readonly kind: "unreadable" };

export default THeaderMacro;
