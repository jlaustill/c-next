/**
 * How a variable's initializer is rendered.
 *
 * ADR-015 zero-initializes a variable that declares none, so the two arms are
 * genuinely different renderings rather than one with a null.
 *
 * ## The order inside the `expression` arm is load-bearing
 *
 * `renderTypeName` is asked FIRST and OUTSIDE the `withExpectedType` window --
 * it is what the window is opened with. `renderExpression` runs inside it, and
 * `resolveExpressionType` runs inside it too, AFTER the render: MISRA C:2012
 * Rule 10.3's cross-category check compares what the expression turned out to
 * be against what the declaration expects, so asking before the render would
 * ask about an expression that had not been typed yet.
 */
type TPlannedVariableInitializer =
  /** ADR-015: no initializer, so the type's zero value. */
  | { readonly kind: "zero"; readonly render: (isArray: boolean) => string }
  | {
      readonly kind: "expression";
      readonly renderTypeName: () => string;
      readonly renderExpression: () => string;
      readonly resolveExpressionType: () => string | null;
    };

export default TPlannedVariableInitializer;
