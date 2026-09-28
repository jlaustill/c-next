import type TEssentialCategory from "./TEssentialCategory";
import type TOverflowBehavior from "./TOverflowBehavior";
import type TValueBinding from "./TValueBinding";

/**
 * What kind of expression produced an operand's type (#1668). The typer
 * reports it; each consuming rule decides what the form means for it, so no
 * policy hides inside the typer.
 */
type TOperandForm =
  /** A variable, parameter, `for` variable, field, element or member */
  | { readonly kind: "declared" }
  | { readonly kind: "call" }
  | {
      readonly kind: "literal";
      readonly literal: "integer" | "float" | "bool" | "char";
      readonly suffixed: boolean;
      /** A minus applied to the literal itself, `-5` (not `-(5 + a)`) */
      readonly negated: boolean;
    }
  | { readonly kind: "cast" }
  /** One bit of a scalar, `x[3]` */
  | { readonly kind: "bitIndex" }
  /** A bit range of a scalar, `x[0, 8]`; the width when it folds */
  | { readonly kind: "bitRange"; readonly width: number | null }
  /** An applied `||`, `&&`, `=`, `!=`, `<`, `>`, `<=`, `>=`, or `!` */
  | { readonly kind: "boolean" }
  /** An arithmetic or bitwise combination, with its value leaves */
  | {
      readonly kind: "composite";
      readonly leaves: ReadonlyArray<IOperandType | null>;
    }
  | {
      readonly kind: "ternary";
      readonly arms: readonly [IOperandType | null, IOperandType | null];
    }
  /** `Enum.MEMBER`, however qualified */
  | { readonly kind: "enumMember" }
  /**
   * A C or C++ header's value. `indeterminate`: a C++ overload set whose
   * return categories disagree, so the call's category is unknown here.
   */
  | { readonly kind: "foreign"; readonly indeterminate: boolean };

/**
 * The value type of one operand, as the one operand typer decided it
 * (#1668). Facts only: every rule that reads it applies its own policy.
 */
interface IOperandType {
  /**
   * The one spelling of the value's type after every applied subscript --
   * `u32`, `f32`, `bool`, `char`, `string<8>`, a struct's or enum's C name.
   * Null when the operand has a category but no single type (a C
   * `int_fast16_t`, a mixed composite).
   */
  readonly typeName: string | null;
  /**
   * The C type a header spelled for the value, at its element: `double`,
   * `int_fast16_t`. Null for a C-Next value. What a write casts back to when
   * `typeName` cannot say it, an integer the target gives no width (#1760
   * review).
   */
  readonly cType: string | null;
  /** Dimensions still to subscript, leading first; empty for a scalar */
  readonly dimensions: ReadonlyArray<number | string>;
  readonly category: TEssentialCategory;
  /** An integer's width in bits; null when unknown or not an integer */
  readonly bitWidth: number | null;
  /** `N` of a `string<N>` value */
  readonly stringCapacity: number | null;
  /** The enum's C name, for a value of a named C-Next enum */
  readonly enumTypeName: string | null;
  /** The bitmap's C name, for a whole bitmap value */
  readonly bitmapTypeName: string | null;
  /**
   * ADR-044 overflow behavior -- ONLY for a whole named variable, parameter
   * or member. A field, element or call result carries none.
   */
  readonly overflow: TOverflowBehavior | null;
  /** Evaluating it calls a function, or reads a volatile or atomic declaration */
  readonly hasSideEffect: boolean;
  readonly form: TOperandForm;
  /** For a name-rooted operand, what the root name binds to */
  readonly binding: TValueBinding | null;
}

export default IOperandType;
