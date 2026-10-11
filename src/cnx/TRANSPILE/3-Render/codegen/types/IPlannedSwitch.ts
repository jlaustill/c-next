import type IPlannedSwitchCase from "./IPlannedSwitchCase";

/**
 * An ADR-025 switch statement, decided (#1445 box 3).
 *
 * What is left for the generator is the rendering: which label opens the
 * brace, how deep each line indents, and Issue #855's MISRA C:2012 Rule 16.4
 * default. Those are the decisions it should own.
 */
interface IPlannedSwitch {
  /** The rendered subject expression. */
  readonly subject: string;

  /**
   * The subject's enum type, when it has one (Issue #471).
   *
   * A bare identifier label is resolved against this enum's members, so a
   * `case IDLE:` inside `switch (state)` emits `EState_IDLE`.
   */
  readonly subjectEnumType: string | undefined;

  readonly cases: readonly IPlannedSwitchCase[];

  /**
   * The explicit `default`'s body, or null when the source declares none.
   *
   * Null is not "no default": Issue #855 requires one for MISRA C:2012
   * Rule 16.4, and the generator emits an empty one. The distinction the plan
   * carries is whether the SOURCE wrote it.
   */
  readonly renderDefaultBody: (() => readonly string[]) | null;
}

export default IPlannedSwitch;
