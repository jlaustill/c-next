/**
 * The facts ADR-013 auto-const (#268) is decided from.
 *
 * Auto-const is asked about a parameter in two different representations --
 * a parse-tree parameter while generating a body, and a resolved symbol while
 * generating a header -- and ADR-013 requires the two to reach the same
 * answer ("the .h matches the .c"). Naming the facts here is what lets one
 * rule serve both: each caller looks the facts up in its own vocabulary, and
 * neither one owns the decision.
 */
interface IAutoConstFacts {
  /** The C-Next type name, e.g. `u32`, `f32`, `ISR`, `Point`, `string<32>`. */
  readonly baseType: string;

  /** Whether the function body assigns through this parameter. */
  readonly isModified: boolean;

  /** Whether the source wrote `const` on the parameter itself. */
  readonly isExplicitlyConst: boolean;

  /**
   * Whether the enclosing function is assigned to a C callback typedef.
   * The typedef dictates the parameter shape, so C-Next may not narrow it.
   */
  readonly isCallbackCompatible: boolean;

  /** Whether the parameter is an array. */
  readonly isArray: boolean;

  /** Whether `baseType` names an enum, which ADR-013 passes by value. */
  readonly isKnownEnum: boolean;
}

export default IAutoConstFacts;
