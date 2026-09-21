/**
 * An `if` statement: a condition, a then branch, an optional else, and the
 * repeated-`.char_count` counts the strlen cache is built from.
 *
 * ## Why the counts are eager and the renders are not
 *
 * Counting walks the tree and returns a map; it emits nothing and registers
 * nothing, so asking at plan time costs exactly what asking at render time
 * cost. The renders are thunks because the generator has to interleave them
 * with `flushPendingTempDeclarations` -- condition, flush, then branch, else
 * branch -- and a temp queued by the condition that is not flushed before the
 * branches render ends up declared INSIDE the branch that reads it (Issue
 * #250). Rendering everything at plan time would collapse the three flush
 * points into one.
 *
 * The counts deliberately cover the condition and the THEN block only, never
 * the else. That asymmetry is the existing behavior and is preserved rather
 * than tidied: widening it would cache a length for a branch the cache
 * declaration does not dominate.
 */
interface IPlannedIf {
  /** Variable name to number of `.char_count` reads, condition + then block. */
  readonly lengthCounts: Map<string, number>;
  readonly renderCondition: () => string;
  readonly renderThen: () => string;
  /** Null when the statement has no `else`. */
  readonly renderElse: (() => string) | null;
}

export default IPlannedIf;
