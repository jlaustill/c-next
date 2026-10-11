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
  | Exclude<TConstResult, { readonly kind: "value" | "float" }>;

export default TSettledConst;
