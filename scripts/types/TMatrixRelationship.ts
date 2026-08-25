/**
 * Issue #1219: How the construct under test crosses a file boundary.
 *
 * The first three are consumer-side -- the fixture reaches OUT to a declaration
 * that many hops away. The last two are provider-side: the declaration lives in
 * this file and is reached INTO from elsewhere. #1164 is only observable
 * provider-side, which is why the two halves are not redundant.
 *
 * Provider-side derivation needs to know which FILE a construct was emitted
 * from. `.expected.error` carries no path, so it is not derivable today -- see
 * MatrixCell.isDerivable and the tracking issue.
 */
type TMatrixRelationship =
  | "same-file"
  | "imported-direct"
  | "imported-transitive"
  | "exercised-from-one-away"
  | "exercised-through-chain";

export default TMatrixRelationship;
