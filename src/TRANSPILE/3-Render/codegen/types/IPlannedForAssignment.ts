/**
 * An assignment appearing in a `for` header -- in the init or the update.
 *
 * #1445 box 3: ONE shape, where there were two. `generateForAssignment`
 * handled the init form and `generateFor` open-coded the update form inline,
 * with the same three reads and the same `AssignmentOperatorMapper` call
 * duplicated. Two code paths that must produce identical output is what
 * CLAUDE.md calls the project's worst anti-pattern; the grammar's `forUpdate`
 * and `forAssignment` carry the same three children, so they plan to the same
 * record and render through the same function.
 *
 * Both renders are thunks and the target is rendered before the value, which
 * is today's order. The operator is NOT mapped here: `AssignmentOperatorMapper`
 * rejects an operator it does not know, and moving that rejection ahead of the
 * two renders would change which diagnostic a malformed header reports first.
 */
interface IPlannedForAssignment {
  readonly renderTarget: () => string;
  readonly renderValue: () => string;
  /** The C-Next operator as written, e.g. `<-` or `+<-`. */
  readonly operatorText: string;
  /** Source line, for the diagnostic if the operator is not one we map. */
  readonly operatorLine: number | undefined;
}

export default IPlannedForAssignment;
