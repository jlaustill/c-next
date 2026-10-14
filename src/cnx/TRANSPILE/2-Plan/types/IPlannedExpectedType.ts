/**
 * The type a value is rendered against, as 2.3 reads it: what sets MISRA
 * 7.2's `U`, a bare enum member's qualification, and a struct
 * initializer's type (#1991)
 */
interface IPlannedExpectedType {
  readonly type: string | null;
  /** A function argument's: its bare enum member is not resolved against the parameter */
  readonly suppressBareEnumResolution: boolean;
}

export default IPlannedExpectedType;
