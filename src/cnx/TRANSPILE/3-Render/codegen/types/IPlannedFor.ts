import type IPlannedForAssignment from "./IPlannedForAssignment";
import type IPlannedForVarDecl from "./IPlannedForVarDecl";

/**
 * A `for` header and its body.
 *
 * Every render is a thunk, and that is the whole contract of this record.
 * Issue #250 hoists the temps each clause queues out in front of the loop, and
 * it does so by flushing between clauses: init, flush, condition, flush,
 * update, flush, body. A temp that is not flushed before the next clause
 * renders lands in the wrong group, and one not flushed before the BODY lands
 * inside the loop -- declared where the header that reads it cannot see it.
 * Rendering any clause at plan time collapses those four flush points.
 *
 * `for (;;)` never reaches codegen -- it is E0707 in pass 2.1 (ADR-068) -- so
 * the condition is always present and is not nullable here.
 */
interface IPlannedFor {
  /** The init clause, absent in `for (; i < n; i +<- 1)`. */
  readonly init: TPlannedForInit | null;
  readonly renderCondition: () => string;
  /** The update clause, absent in `for (u32 i <- 0; i < n;)`. */
  readonly update: IPlannedForAssignment | null;
  readonly renderBody: () => string;
}

/** A `for` init is either a declaration or an assignment to something existing. */
type TPlannedForInit =
  | { readonly kind: "varDecl"; readonly plan: IPlannedForVarDecl }
  | { readonly kind: "assignment"; readonly plan: IPlannedForAssignment };

export default IPlannedFor;
