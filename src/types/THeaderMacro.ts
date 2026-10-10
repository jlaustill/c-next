/**
 * An object-like macro a C or C++ header defines, typed from its replacement
 * tokens (ADR-024, #1688). A floating literal makes it floating when nothing
 * else in the expansion is unreadable -- `typeName` the C type it has, when
 * C-Next names one; a cast or call decides the type whatever it holds. Integer
 * literals, arithmetic and bitwise operators, parentheses and other integer
 * macros, and nothing else, make it integer. A character constant alone,
 * parenthesized or not, is character, as written inline. Anything else -- a
 * call, a cast, a pointer dereference, a string, a name no header defines --
 * is unreadable.
 */
type THeaderMacro =
  | { readonly kind: "floating"; readonly typeName: "f32" | "f64" | null }
  | {
      readonly kind: "integer";
      /**
       * #1283 review: the value, when C-Next can read it -- plain integer
       * arithmetic whose every step stays in `0..INT_MAX`, where C's `int`,
       * `unsigned` and `long` arithmetic all agree. Null for any other integer
       * expansion (a `sizeof`, a cast, a negative step), which C still reads.
       */
      /** The value under each target `int` width, or null where C-Next cannot read it */
      readonly valueByIntBits: ReadonlyMap<number, number | null>;
    }
  | { readonly kind: "character" }
  | { readonly kind: "unreadable" };

export default THeaderMacro;
