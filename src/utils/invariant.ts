/**
 * Issue #1322: assert a condition the program guarantees, naming the guarantee.
 *
 * ## Why this exists
 *
 * `output/` raises two different kinds of failure through one mechanism. Most
 * are user-facing diagnostics -- a rejection of the author's `.cnx`, which
 * belongs in pass 2.1 with a code and a real position. Sixteen are internal
 * invariants: statements that cannot be false for any input, valid or invalid,
 * and whose violation means the transpiler is wrong rather than the program.
 *
 * Before this there was no assertion helper in the repo -- no `invariant`, no
 * `assertNever` -- only a convention, and the convention was inconsistent:
 * four sites in `CodeGenerator` opened their message with `Internal:` while two
 * siblings of the same family said `Error:`, which reads as something the
 * author did wrong. A reader cannot tell an invariant from a diagnostic by
 * looking, and neither can the classification gate.
 *
 * ## Why it is an assertion function and not a `throw`
 *
 * `asserts condition` narrows for the code that follows, and that turns out to
 * matter more than it first appears. #1321's audit classified four
 * `StringHandlers` guards as "dead -- delete". Deleting them produces
 * `TS18048: possibly 'undefined'` on the next line: the guard is doing type
 * work as well as runtime work. It is unreachable AND load-bearing, which is
 * not "dead" -- it is an invariant, and this is what lets it say so without
 * losing the narrowing.
 *
 * ## The statement, not the symptom
 *
 * `statement` says what is guaranteed ("a struct field always has a type"),
 * not what went wrong ("structTypeInfo is undefined"). The reader of a crash
 * report needs the promise that was broken; the stack trace already carries
 * where.
 */
function invariant(condition: unknown, statement: string): asserts condition {
  if (statement.length === 0) {
    // An empty statement is the assertion equivalent of a guard that cannot
    // fail: it fires and tells the reader nothing.
    throw new Error("Internal: invariant requires a statement");
  }
  if (!condition) {
    throw new Error(`Internal: ${statement}`);
  }
}

export default invariant;
