import type ISourcePosition from "../utils/types/ISourcePosition";

/**
 * What a `TConstExpr` is worth, by the one rule (#1175, #1669): the value the
 * same expression has when the program runs (ADR-044 "Values fixed at compile
 * time").
 *
 * - `value`: computed. `typeName` is the type the arithmetic happened at, or
 *   null when no operand gave it one.
 * - `notConstant`: something in it has no value while the program compiles.
 * - `overflow`: the arithmetic happens at `typeName`, which cannot hold the
 *   result, so at run time the program would clamp or wrap there.
 * - `foreign`: it depends on a name only C knows the value of -- a macro, or
 *   `sizeof` of a type whose size the target decides. C can evaluate it where C
 *   allows (an array dimension); C-Next cannot use it where it needs the value.
 */
type TConstResult =
  | {
      readonly kind: "value";
      readonly value: bigint;
      readonly typeName: string | null;
    }
  | {
      readonly kind: "notConstant";
      readonly reason:
        | "variable"
        | "parameter"
        | "function"
        | "call"
        | "scope"
        | "unfolded"
        | "laterMember"
        | "selfMember"
        | "unknown"
        | "subscript"
        | "float"
        | "string"
        | "character"
        | "initializer"
        | "address"
        | "member"
        | "divisionByZero"
        | "negativeShift";
      /** The offending part as the source spells it, for a message */
      readonly spelling: string;
      readonly at: ISourcePosition | null;
    }
  | { readonly kind: "overflow"; readonly typeName: string }
  | { readonly kind: "foreign" };

export default TConstResult;
