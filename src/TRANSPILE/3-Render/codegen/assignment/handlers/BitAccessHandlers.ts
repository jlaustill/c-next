/**
 * Integer bit access assignment handlers (ADR-065).
 *
 * Handles bit manipulation on integer variables:
 * - INTEGER_BIT: flags[3] <- true
 * - INTEGER_BIT_RANGE: flags[0, 3] <- 5
 * - ARRAY_ELEMENT_BIT: matrix[i][j][FIELD_BIT] <- false
 * - ARRAY_ELEMENT_BIT_RANGE: row[i][0, 4] <- 6
 * - STRUCT_CHAIN_BIT_RANGE: devices[0].control[0, 4] <- 15
 *
 * A single bit at the end of a member chain (`item.byte[7] <- true`) is
 * MEMBER_CHAIN's, which writes it the same way.
 */
import AssignmentKind from "../../../../../types/AssignmentKind";
import AssignmentHandlerUtils from "./AssignmentHandlerUtils";
import TAssignmentHandler from "./TAssignmentHandler";

// #1322: `validateNotCompound` is gone -- E0857 in pass 2.1. It was defined
// here AND in the sibling handler, verbatim: one rule, two copies, in a group
// of six.
//
// #1760 review: a float variable's bits had their own path here, beside
// `writeBits`, so a float element or field reached `writeBits` as an integer.
// The decision is `writeBits`'s alone now.

/**
 * All bit access handlers for registration.
 *
 * The kinds stay distinct -- the classifier tells them apart -- and share one
 * emission: every one is a write of the bits of the target minus its final
 * subscript (#1668 review).
 *
 * Issue #1115: `this.flags[3]` no longer needs its own kinds. It classifies as
 * INTEGER_BIT / INTEGER_BIT_RANGE like any other integer bit access, because
 * resolvedBaseIdentifier already includes the scope prefix — which is why the
 * retired THIS_BIT / THIS_BIT_RANGE mapped to these same two handlers (#954).
 */
const bitAccessHandlers: ReadonlyArray<[AssignmentKind, TAssignmentHandler]> = [
  [AssignmentKind.INTEGER_BIT, AssignmentHandlerUtils.writeBits],
  [AssignmentKind.INTEGER_BIT_RANGE, AssignmentHandlerUtils.writeBits],
  [AssignmentKind.ARRAY_ELEMENT_BIT, AssignmentHandlerUtils.writeBits],
  [AssignmentKind.ARRAY_ELEMENT_BIT_RANGE, AssignmentHandlerUtils.writeBits],
  [AssignmentKind.STRUCT_CHAIN_BIT_RANGE, AssignmentHandlerUtils.writeBits],
];

export default bitAccessHandlers;
