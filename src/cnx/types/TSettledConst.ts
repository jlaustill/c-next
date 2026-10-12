import type TConstResult from "./TConstResult";

/**
 * A const's settled value (#1175): its value as decimal digits -- a u64 is
 * past what a `number` holds exactly, and a `bigint` is not JSON (#1298) --
 * or why it has none, kept so a use of the const can say the cause rather
 * than only that there is no value.
 */
type TSettledConst =
  | {
      readonly kind: "value";
      readonly digits: string;
      readonly typeName: string;
    }
  | {
      /** A float const's value, held at its declared type, as `String` spells it */
      readonly kind: "float";
      readonly digits: string;
      readonly typeName: "f32" | "f64";
    }
  | {
      /** #1739: a bool const's value */
      readonly kind: "bool";
      readonly value: boolean;
    }
  | {
      /**
       * #1739: a const of a named type whose initializer has an integer value
       * -- an enum's member value. `typeName` is the type's C name; 1.3 may
       * spell an enum's kind `struct` (#1720), so what the type is is the
       * symbol table's answer, not this one.
       */
      readonly kind: "named";
      readonly digits: string;
      readonly typeName: string;
    }
  | Exclude<TConstResult, { readonly kind: "value" | "float" }>;

export default TSettledConst;
