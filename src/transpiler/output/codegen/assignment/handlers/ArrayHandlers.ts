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
import TAssignmentHandler from "./TAssignmentHandler";
import CodeGenState from "../../../../state/CodeGenState";
import TypeValidator from "../../TypeValidator";
import type ICodeGenApi from "../../types/ICodeGenApi";

/** Get typed generator reference */
function gen(): ICodeGenApi {
  return CodeGenState.generator as ICodeGenApi;
}

/**
 * Handle simple array element: arr[i] <- value
 *
 * Uses resolvedTarget which includes scope prefix and subscript,
 * e.g., "data[0]" inside scope ArrayBug -> "ArrayBug_data[0]"
 */
function handleArrayElement(ctx: IAssignmentContext): string {
  return `${ctx.resolvedTarget} ${ctx.cOp} ${ctx.generatedValue};`;
}

/**
 * Handle multi-dimensional array element: matrix[i][j] <- value
 *
 * Uses resolvedTarget which includes scope prefix and all subscripts.
 * Uses resolvedBaseIdentifier for type lookups to support scoped arrays.
 */
function handleMultiDimArrayElement(ctx: IAssignmentContext): string {
  // Use resolvedBaseIdentifier for type lookup (includes scope prefix)
  // e.g., "ArrayBug_data" instead of "data"
  const typeInfo = CodeGenState.getVariableTypeInfo(ctx.resolvedBaseIdentifier);

  // ADR-036: Compile-time bounds checking for constant indices
  if (typeInfo?.arrayDimensions) {
    const line = ctx.subscripts[0]?.start?.line ?? 0;
    TypeValidator.checkArrayBounds(
      ctx.resolvedBaseIdentifier,
      [...typeInfo.arrayDimensions],
      [...ctx.subscripts],
      line,
      (expr) => gen().tryEvaluateConstant(expr),
    );
  }

  return `${ctx.resolvedTarget} ${ctx.cOp} ${ctx.generatedValue};`;
}

/**
 * Handle array slice assignment: buffer[0, 10] <- source
 *
 * Validates:
 * - Offset and length must be compile-time constants
 * - Only valid on 1D arrays
 * - Bounds checking at compile time
 */
function handleArraySlice(ctx: IAssignmentContext): string {
  if (ctx.isCompound) {
    throw new Error(
      `Compound assignment operators not supported for slice assignment: ${ctx.cnextOp}`,
    );
  }

  // Use resolvedBaseIdentifier for type lookup (includes scope prefix)
  const name = ctx.resolvedBaseIdentifier;
  const typeInfo = CodeGenState.getVariableTypeInfo(name);

  // Get line number for error messages
  const line = ctx.subscripts[0].start?.line ?? 0;

  // Validate 1D array only
  if (typeInfo?.arrayDimensions && typeInfo.arrayDimensions.length > 1) {
    // Use raw identifier in error message for clarity
    const rawName = ctx.identifiers[0];
    throw new Error(
      `${line}:0 Error: Slice assignment is only valid on one-dimensional arrays. ` +
        `'${rawName}' has ${typeInfo.arrayDimensions.length} dimensions. ` +
        `Access the innermost dimension first (e.g., ${rawName}[index][offset, length]).`,
    );
  }

  // Validate offset is compile-time constant
  const offsetValue = gen().tryEvaluateConstant(ctx.subscripts[0]);
  if (offsetValue === undefined) {
    throw new Error(
      `${line}:0 Error: Slice assignment offset must be a compile-time constant. ` +
        `Runtime offsets are not allowed to ensure bounds safety.`,
    );
  }

  // Validate length is compile-time constant
  const lengthValue = gen().tryEvaluateConstant(ctx.subscripts[1]);
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
  } else if (typeInfo?.arrayDimensions?.[0]) {
    capacity = typeInfo.arrayDimensions[0];
  } else {
    // Use raw identifier in error message for clarity
    const rawName = ctx.identifiers[0];
    throw new Error(
      `${line}:0 Error: Cannot determine buffer size for '${rawName}' at compile time.`,
    );
  }

  // Bounds validation
  if (offsetValue + lengthValue > capacity) {
    // Use raw identifier in error message for clarity
    const rawName = ctx.identifiers[0];
    throw new Error(
      `${line}:0 Error: Slice assignment out of bounds: ` +
        `offset(${offsetValue}) + length(${lengthValue}) = ${offsetValue + lengthValue} ` +
        `exceeds buffer capacity(${capacity}) for '${rawName}'.`,
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
  CodeGenState.needsString = true;

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
