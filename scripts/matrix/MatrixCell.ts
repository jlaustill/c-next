/**
 * Issue #1219: The scope-context matrix vocabulary.
 *
 * One place decides what a cell IS, how it is spelled, and whether the tooling
 * can currently derive it. Every consumer reads that decision rather than
 * re-deriving it -- a second list of contexts that agreed with this one only by
 * coincidence is exactly the divergence the project forbids.
 */

import TMatrixContext from "../types/TMatrixContext";
import TMatrixRelationship from "../types/TMatrixRelationship";

const CONTEXTS: readonly TMatrixContext[] = [
  "global-variable",
  "top-level-function",
  "scope-member",
  "scope-method",
];

const RELATIONSHIPS: readonly TMatrixRelationship[] = [
  "same-file",
  "imported-direct",
  "imported-transitive",
  "exercised-from-one-away",
  "exercised-through-chain",
];

/**
 * Relationships the tooling can currently establish.
 *
 * The consumer-side three come from the resolved include graph. The
 * provider-side two need to know which FILE a construct was emitted from;
 * `.expected.error` carries no path, so they are reported as not-derivable
 * rather than silently counted as empty -- an undetectable cell and an
 * uncovered cell are different claims and must not render the same.
 */
const DERIVABLE_RELATIONSHIPS: readonly TMatrixRelationship[] = [
  "same-file",
  "imported-direct",
  "imported-transitive",
];

/** Encode a cell as a stable key. Never build this string by hand elsewhere. */
function key(
  context: TMatrixContext,
  relationship: TMatrixRelationship,
): string {
  return `${context}|${relationship}`;
}

/** Every cell in the matrix, in stable report order. */
function all(): {
  context: TMatrixContext;
  relationship: TMatrixRelationship;
}[] {
  const cells: {
    context: TMatrixContext;
    relationship: TMatrixRelationship;
  }[] = [];
  for (const context of CONTEXTS) {
    for (const relationship of RELATIONSHIPS) {
      cells.push({ context, relationship });
    }
  }
  return cells;
}

/** Whether the tooling can establish occupancy for this relationship today. */
function isDerivable(relationship: TMatrixRelationship): boolean {
  return DERIVABLE_RELATIONSHIPS.includes(relationship);
}

/**
 * Map an include-chain depth to its consumer-side relationship.
 *
 * Depth is the longest resolved `#include` chain reachable from the fixture,
 * so 0 means the fixture stands alone and 2+ means a declaration is reached
 * through an intermediate file (the #1178 failure shape).
 */
function relationshipForDepth(depth: number): TMatrixRelationship {
  if (depth <= 0) return "same-file";
  if (depth === 1) return "imported-direct";
  return "imported-transitive";
}

class MatrixCell {
  static readonly CONTEXTS = CONTEXTS;
  static readonly RELATIONSHIPS = RELATIONSHIPS;
  static readonly DERIVABLE_RELATIONSHIPS = DERIVABLE_RELATIONSHIPS;
  static key = key;
  static all = all;
  static isDerivable = isDerivable;
  static relationshipForDepth = relationshipForDepth;
}

export default MatrixCell;
