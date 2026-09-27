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
import invariant from "../../../../../utils/invariant";
import AssignmentKind from "../../../../../transpiler/types/AssignmentKind";
import IAssignmentContext from "../../../../2-Plan/types/IAssignmentContext";
import AssignmentHandlerUtils from "./AssignmentHandlerUtils";
import TAssignmentHandler from "./TAssignmentHandler";

// #1322: `validateNotCompound` is gone -- E0857 in pass 2.1. It was defined
// here AND in the sibling handler, verbatim: one rule, two copies, in a group
// of six.

/**
 * A bit or bit range of a float variable, `f32Var[3] <- true`, which is a
 * union type-pun rather than a shift (ADR-007). Null for any other value,
 * decided by the typer's category before anything is rendered, so an integer
 * target's subscripts render once, in `writeBits`.
 */
function floatBitWrite(ctx: IAssignmentContext): string | null {
  const typeInfo = ctx.target.typeInfo;
  if (ctx.target.last?.before?.category !== "floating" || !typeInfo) {
    return null;
  }
  const last = ctx.postfixOps.at(-1);
  invariant(last?.kind === "subscript", "a bit write ends in a subscript");
  const [start, width] = last.renderIndexes();
  return ctx.state
    .requireGenerator()
    .generateFloatBitWrite(
      ctx.resolvedBaseIdentifier,
      typeInfo,
      start,
      width ?? null,
      ctx.generatedValue,
    );
}

/**
 * A bit or bit range of a variable: `flags[3] <- true`, `flags[0, 3] <- 5`,
 * and of a float variable, `f32Var[3] <- true`.
 */
function handleVariableBits(ctx: IAssignmentContext): string {
  return floatBitWrite(ctx) ?? AssignmentHandlerUtils.writeBits(ctx);
}

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
  [AssignmentKind.INTEGER_BIT, handleVariableBits],
  [AssignmentKind.INTEGER_BIT_RANGE, handleVariableBits],
  [AssignmentKind.ARRAY_ELEMENT_BIT, AssignmentHandlerUtils.writeBits],
  [AssignmentKind.ARRAY_ELEMENT_BIT_RANGE, AssignmentHandlerUtils.writeBits],
  [AssignmentKind.STRUCT_CHAIN_BIT_RANGE, AssignmentHandlerUtils.writeBits],
];

export default bitAccessHandlers;
