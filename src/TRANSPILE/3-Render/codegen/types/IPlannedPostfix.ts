import type TPlannedPostfixOp from "./TPlannedPostfixOp";

/**
 * A postfix expression: a primary, and the operations applied to it.
 *
 * #1445 box 3: what the generator read off the tree was the op KINDS and two
 * facts about the leading subscript run. Both are here, and the renders that
 * used to be reached through the node are thunks.
 */
interface IPlannedPostfix {
  /**
   * The primary's identifier, when it is one.
   *
   * Drives struct-parameter detection and the type-registry lookup, so it is
   * the source spelling rather than anything emitted.
   */
  readonly rootIdentifier: string | undefined;

  /**
   * The primary, unevaluated.
   *
   * Rendering it resolves a parameter dereference (Issue #1100) and can queue
   * a temp, so it happens where it happened before: after the plan is in hand,
   * before the depth check, and before any operation renders.
   */
  readonly renderPrimary: () => string;

  /**
   * Issue #1106: the base a leading subscript run applies to, or null.
   *
   * `this.flags[4][3]` and `global.flags[4][3]` reach the same variable, but
   * as `primaryExpression postfixOp*` the prefix keyword is the primary and
   * the member access is the first op -- so the base has to be resolved before
   * the run can be counted, and all three spellings resolve here rather than
   * only the bare one.
   */
  readonly subscriptBase: IPlannedSubscriptBase | null;

  /**
   * How many operations of the leading run are subscripts.
   *
   * Counted by the planner through `SubscriptDepthValidator`, the same
   * function the write path calls, so the two paths cannot diverge on what
   * counts as a subscript.
   */
  readonly leadingSubscriptCount: number;

  readonly ops: readonly TPlannedPostfixOp[];
}

/** The variable a leading subscript run indexes, and how to name it. */
interface IPlannedSubscriptBase {
  /** The registry key -- `Scope__x` for `this.x`, the bare name otherwise. */
  readonly name: string;
  /** What a diagnostic calls it: `this.flags`, `global.flags`, `flags`. */
  readonly displayName: string;
}

export default IPlannedPostfix;
