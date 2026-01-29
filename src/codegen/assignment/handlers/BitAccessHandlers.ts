/**
 * Integer bit access assignment handlers (ADR-109).
 *
 * Handles bit manipulation on integer variables:
 * - INTEGER_BIT: flags[3] <- true
 * - INTEGER_BIT_RANGE: flags[0, 3] <- 5
 * - STRUCT_MEMBER_BIT: item.byte[7] <- true
 * - ARRAY_ELEMENT_BIT: matrix[i][j][FIELD_BIT] <- false
 */
import AssignmentKind from "../AssignmentKind";
import IAssignmentContext from "../IAssignmentContext";
import IHandlerDeps from "./IHandlerDeps";
import BitUtils from "../../../utils/BitUtils";
import TAssignmentHandler from "./TAssignmentHandler";

/**
 * Validate compound operators are not used with bit access.
 */
function validateNotCompound(ctx: IAssignmentContext): void {
  if (ctx.isCompound) {
    throw new Error(
      `Compound assignment operators not supported for bit field access: ${ctx.cnextOp}`,
    );
  }
}

/**
 * Handle single bit on integer variable: flags[3] <- true
 * Also handles float bit indexing: f32Var[3] <- true
 */
function handleIntegerBit(ctx: IAssignmentContext, deps: IHandlerDeps): string {
  validateNotCompound(ctx);

  const name = ctx.identifiers[0];
  const bitIndex = deps.generateExpression(ctx.subscripts[0]);
  const typeInfo = deps.typeRegistry.get(name);

  // Check for float bit indexing
  if (typeInfo) {
    const floatResult = deps.generateFloatBitWrite(
      name,
      typeInfo,
      bitIndex,
      null, // single bit, no width
      ctx.generatedValue,
    );
    if (floatResult !== null) {
      return floatResult;
    }
  }

  // Integer bit write
  return BitUtils.singleBitWrite(name, bitIndex, ctx.generatedValue);
}

/**
 * Handle bit range on integer variable: flags[0, 3] <- 5
 * Also handles float bit range: f32Var[0, 8] <- 0xFF
 */
function handleIntegerBitRange(
  ctx: IAssignmentContext,
  deps: IHandlerDeps,
): string {
  validateNotCompound(ctx);

  const name = ctx.identifiers[0];
  const start = deps.generateExpression(ctx.subscripts[0]);
  const width = deps.generateExpression(ctx.subscripts[1]);
  const typeInfo = deps.typeRegistry.get(name);

  // Check for float bit indexing
  if (typeInfo) {
    const floatResult = deps.generateFloatBitWrite(
      name,
      typeInfo,
      start,
      width, // pass width for range writes
      ctx.generatedValue,
    );
    if (floatResult !== null) {
      return floatResult;
    }
  }

  // Integer bit range write
  return BitUtils.multiBitWrite(name, start, width, ctx.generatedValue);
}

/**
 * Handle bit on struct member: item.byte[7] <- true
 * This is handled through MEMBER_CHAIN with bit detection.
 */
function handleStructMemberBit(
  ctx: IAssignmentContext,
  deps: IHandlerDeps,
): string {
  validateNotCompound(ctx);

  // The target up to the last subscript is the struct member path
  // The last subscript is the bit index
  // This pattern is complex - the target needs to be built from the member chain
  // For now, delegate to the existing target generator and build the bit op
  const target = deps.generateAssignmentTarget(ctx.targetCtx);

  // Extract the bit index from the last subscript
  const bitIndex = deps.generateExpression(ctx.subscripts.at(-1)!);

  // Get the member type to determine if we need 1ULL for 64-bit
  // For now, use conservative approach with 1
  const one = "1";
  const intValue = BitUtils.boolToInt(ctx.generatedValue);

  return `${target} = (${target} & ~(${one} << ${bitIndex})) | (${intValue} << ${bitIndex});`;
}

/**
 * Handle bit on multi-dimensional array element: matrix[i][j][FIELD_BIT] <- false
 */
function handleArrayElementBit(
  ctx: IAssignmentContext,
  deps: IHandlerDeps,
): string {
  validateNotCompound(ctx);

  const arrayName = ctx.identifiers[0];
  const typeInfo = deps.typeRegistry.get(arrayName);

  if (!typeInfo?.arrayDimensions) {
    throw new Error(`Error: ${arrayName} is not an array`);
  }

  const numDims = typeInfo.arrayDimensions.length;

  // Array indices are subscripts[0..numDims-1], bit index is subscripts[numDims]
  const arrayIndices = ctx.subscripts
    .slice(0, numDims)
    .map((e) => `[${deps.generateExpression(e)}]`)
    .join("");
  const bitIndex = deps.generateExpression(ctx.subscripts[numDims]);

  const arrayElement = `${arrayName}${arrayIndices}`;

  // Use 1ULL for 64-bit element types
  const one = BitUtils.oneForType(typeInfo.baseType);
  const intValue = BitUtils.boolToInt(ctx.generatedValue);

  return `${arrayElement} = (${arrayElement} & ~(${one} << ${bitIndex})) | (${intValue} << ${bitIndex});`;
}

/**
 * All bit access handlers for registration.
 */
const bitAccessHandlers: ReadonlyArray<[AssignmentKind, TAssignmentHandler]> = [
  [AssignmentKind.INTEGER_BIT, handleIntegerBit],
  [AssignmentKind.INTEGER_BIT_RANGE, handleIntegerBitRange],
  [AssignmentKind.STRUCT_MEMBER_BIT, handleStructMemberBit],
  [AssignmentKind.ARRAY_ELEMENT_BIT, handleArrayElementBit],
];

export default bitAccessHandlers;
