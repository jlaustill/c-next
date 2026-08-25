/**
 * Issue #1219: Where, structurally, the construct under test lives.
 *
 * These are the four places a C-Next declaration can sit. A check that fires in
 * one of them routinely fails in another -- #1179 (atomic ignored on a scope
 * member) and #1217 (E0800 blind cross-file) are both this failure shape.
 */
type TMatrixContext =
  | "global-variable"
  | "top-level-function"
  | "scope-member"
  | "scope-method";

export default TMatrixContext;
