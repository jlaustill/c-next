/**
 * An ADR-068 `forever` loop: a body and nothing else.
 *
 * It has no controlling expression by construction -- that is the point of the
 * form, and it is why the MISRA C:2012 Rule 14.3 carve-out applies to the
 * `for (;;)` it lowers to: there is no invariant condition to flag.
 *
 * A record of one thunk rather than a bare thunk, so every generator in the
 * control-flow table takes the same kind of argument and a reader does not
 * have to check which one is the exception.
 */
interface IPlannedForever {
  readonly renderBody: () => string;
}

export default IPlannedForever;
