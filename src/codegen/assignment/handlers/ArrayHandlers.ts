/**
 * Array assignment handlers (ADR-109).
 *
 * Handles assignments to array elements:
 * - ARRAY_ELEMENT: arr[i] <- value
 * - MULTI_DIM_ARRAY_ELEMENT: matrix[i][j] <- value
 * - ARRAY_SLICE: buffer[0, 10] <- source
 */
import AssignmentKind from "../AssignmentKind";
import IAssignmentContext from "../IAssignmentContext";
import IHandlerDeps from "./IHandlerDeps";
import { TAssignmentHandler } from "./index";

/**
 * Handle simple array element: arr[i] <- value
 */
function handleArrayElement(
  ctx: IAssignmentContext,
  deps: IHandlerDeps,
): string {
  const name = ctx.identifiers[0];
  const index = deps.generateExpression(ctx.subscripts[0]);

  return `${name}[${index}] ${ctx.cOp} ${ctx.generatedValue};`;
}

/**
 * Handle multi-dimensional array element: matrix[i][j] <- value
 */
function handleMultiDimArrayElement(
  ctx: IAssignmentContext,
  deps: IHandlerDeps,
): string {
  const name = ctx.identifiers[0];
  const indices = ctx.subscripts
    .map((e) => deps.generateExpression(e))
    .join("][");

  return `${name}[${indices}] ${ctx.cOp} ${ctx.generatedValue};`;
}

/**
 * Handle array slice assignment: buffer[0, 10] <- source
 *
 * Validates:
 * - Offset and length must be compile-time constants
 * - Only valid on 1D arrays
 * - Bounds checking at compile time
 */
function handleArraySlice(ctx: IAssignmentContext, deps: IHandlerDeps): string {
  if (ctx.isCompound) {
    throw new Error(
      `Compound assignment operators not supported for slice assignment: ${ctx.cnextOp}`,
    );
  }

  const name = ctx.identifiers[0];
  const typeInfo = deps.typeRegistry.get(name);

  // Get line number for error messages
  const line = ctx.subscripts[0].start?.line ?? 0;

  // Validate 1D array only
  if (typeInfo?.arrayDimensions && typeInfo.arrayDimensions.length > 1) {
    throw new Error(
      `${line}:0 Error: Slice assignment is only valid on one-dimensional arrays. ` +
        `'${name}' has ${typeInfo.arrayDimensions.length} dimensions. ` +
        `Access the innermost dimension first (e.g., ${name}[index][offset, length]).`,
    );
  }

  // Validate offset is compile-time constant
  const offsetValue = deps.tryEvaluateConstant(ctx.subscripts[0]);
  if (offsetValue === undefined) {
    throw new Error(
      `${line}:0 Error: Slice assignment offset must be a compile-time constant. ` +
        `Runtime offsets are not allowed to ensure bounds safety.`,
    );
  }

  // Validate length is compile-time constant
  const lengthValue = deps.tryEvaluateConstant(ctx.subscripts[1]);
  if (lengthValue === undefined) {
    throw new Error(
      `${line}:0 Error: Slice assignment length must be a compile-time constant. ` +
        `Runtime lengths are not allowed to ensure bounds safety.`,
    );
  }

  // Determine buffer capacity
  let capacity: number;
  if (typeInfo?.isString && typeInfo.stringCapacity && !typeInfo.isArray) {
    capacity = typeInfo.stringCapacity + 1;
  } else if (typeInfo?.arrayDimensions && typeInfo.arrayDimensions[0]) {
    capacity = typeInfo.arrayDimensions[0];
  } else {
    throw new Error(
      `${line}:0 Error: Cannot determine buffer size for '${name}' at compile time.`,
    );
  }

  // Bounds validation
  if (offsetValue + lengthValue > capacity) {
    throw new Error(
      `${line}:0 Error: Slice assignment out of bounds: ` +
        `offset(${offsetValue}) + length(${lengthValue}) = ${offsetValue + lengthValue} ` +
        `exceeds buffer capacity(${capacity}) for '${name}'.`,
    );
  }

  if (offsetValue < 0) {
    throw new Error(
      `${line}:0 Error: Slice assignment offset cannot be negative: ${offsetValue}`,
    );
  }

  if (lengthValue <= 0) {
    throw new Error(
      `${line}:0 Error: Slice assignment length must be positive: ${lengthValue}`,
    );
  }

  // Mark that we need string.h for memcpy
  deps.markNeedsString();

  return `memcpy(&${name}[${offsetValue}], &${ctx.generatedValue}, ${lengthValue});`;
}

/**
 * All array handlers for registration.
 */
const arrayHandlers: ReadonlyArray<[AssignmentKind, TAssignmentHandler]> = [
  [AssignmentKind.ARRAY_ELEMENT, handleArrayElement],
  [AssignmentKind.MULTI_DIM_ARRAY_ELEMENT, handleMultiDimArrayElement],
  [AssignmentKind.ARRAY_SLICE, handleArraySlice],
];

export default arrayHandlers;
