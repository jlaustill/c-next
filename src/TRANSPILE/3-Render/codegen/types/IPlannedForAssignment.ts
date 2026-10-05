/**
 * An assignment appearing in a `for` header -- in the init or the update.
 *
 * #1445 box 3: ONE shape for both clauses, since the grammar's `forUpdate` and
 * `forAssignment` carry the same three children as an assignment statement.
 *
 * #1647: and ONE renderer for all three. The header used to concatenate
 * target, mapped operator and value, which skipped the statement path's
 * classification and handlers -- so ADR-044's clamp and MISRA C:2012 Rule
 * 7.2's literal suffix never ran there, and `i +<- 10` on a `u8` wrapped in an
 * update while it saturated as a statement. The render is the statement
 * assignment's own, less its terminator.
 *
 * A thunk, because `IPlannedFor` flushes queued temps between clauses.
 */
interface IPlannedForAssignment {
  readonly render: () => string;
}

export default IPlannedForAssignment;
