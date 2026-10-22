/**
 * Issue #1219: Where, structurally, the construct under test lives.
 *
 * These are the five places a cnx declaration can sit. A check that fires in
 * one of them routinely fails in another -- #1179 (atomic ignored on a scope
 * member) and #1217 (E0800 blind cross-file) are both this failure shape, and
 * so is a `for` header's declaration (#1646, #1823), which is why it is a row
 * of its own rather than part of the function that encloses it.
 */
type TMatrixContext =
  | "global-variable"
  | "top-level-function"
  | "scope-member"
  | "scope-method"
  | "for-header";

export default TMatrixContext;
