/**
 * What a `return` statement carries, if anything.
 *
 * #1445 box 3: `ControlFlowGenerator` asked `node.expression()` twice -- once
 * as a predicate and once with `!` to use it -- which is the shape a union
 * states once.
 */
type TPlannedReturn =
  /** `return;` -- no expression to render. */
  | { readonly kind: "void" }
  /**
   * `return <expr>;`
   *
   * The renderer takes the function's declared return type, because #1277's
   * rule is that a return expression is EXPECTED to be that type and the
   * expectation has to be applied at render time: it is what gives a bare enum
   * member its enum (ADR-017), what types a struct literal that no declaration
   * names, and what puts the MISRA C:2012 Rule 7.2 suffix on `return 1;`.
   *
   * It is a parameter rather than a field because the return type is not a
   * fact about this node -- it belongs to the enclosing function, and the
   * generator is what holds that context.
   */
  | {
      readonly kind: "value";
      readonly render: (expectedType: string | null) => string;
    };

export default TPlannedReturn;
