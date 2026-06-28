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
import type TTypeInfo from "../../types/TTypeInfo";
import CNEXT_TO_C_TYPE_MAP from "../../../../../utils/constants/TypeMappings";

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
 * Per-element write strategy for a slice-assignment destination (Issue #1081).
 *
 * Slice assignment lowers to element-by-element little-endian writes rather than
 * a `memcpy(&dest[off], &value, len)`. `memcpy` between a byte buffer and a
 * wider integer passes incompatible pointer types, violating MISRA C:2012
 * Rule 21.15; writing each element explicitly avoids the call entirely.
 *
 * The destination *element* type determines:
 *  - `bytes`: the element stride. `dest[off + k]` indexes elements, matching
 *    the old `&dest[off]` base address, so a u16[] slice writes whole u16s.
 *  - `wrap`: the cast applied to each extracted little-endian chunk. MISRA
 *    Rule 10.8 forbids casting a composite expression (the `>>`/`&` result)
 *    across essential-type categories, so `char` and signed destinations cast
 *    through a same-width unsigned type first.
 *
 * Throws for element types that cannot be expressed as integer byte writes
 * (float/bool), which would require type punning and are unsupported.
 */
function resolveSliceElement(
  typeInfo: TTypeInfo | undefined,
  line: number,
  rawName: string,
): { bytes: number; wrap: (chunk: string) => string } {
  if (typeInfo?.isString) {
    // string buffers are char[]; cast through uint8_t to satisfy MISRA 10.8.
    return { bytes: 1, wrap: (chunk) => `(char)(uint8_t)${chunk}` };
  }

  const baseType = typeInfo?.baseType ?? "";
  const bytes = Math.floor((typeInfo?.bitWidth ?? 0) / 8);

  if (/^u(8|16|32|64)$/.test(baseType)) {
    const cType = CNEXT_TO_C_TYPE_MAP[baseType];
    return { bytes, wrap: (chunk) => `(${cType})${chunk}` };
  }

  if (/^i(8|16|32|64)$/.test(baseType)) {
    const cType = CNEXT_TO_C_TYPE_MAP[baseType];
    const uType = CNEXT_TO_C_TYPE_MAP[`u${baseType.slice(1)}`];
    return { bytes, wrap: (chunk) => `(${cType})(${uType})${chunk}` };
  }

  throw new Error(
    `${line}:0 Error: Slice assignment is not supported for element type ` +
      `'${baseType}' of '${rawName}'. Only integer and string buffers can be sliced.`,
  );
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

  // Issue #1081: emit per-element little-endian writes instead of memcpy.
  // memcpy between a byte buffer and a wider integer passes incompatible
  // pointer types (MISRA C:2012 Rule 21.15). The slice length is a compile-time
  // constant, so the copy can be fully unrolled at the destination's element
  // granularity with no library call.
  const rawName = ctx.identifiers[0];
  const { bytes, wrap } = resolveSliceElement(typeInfo, line, rawName);

  if (bytes <= 0) {
    throw new Error(
      `${line}:0 Error: Cannot determine element size for '${rawName}'.`,
    );
  }

  if (lengthValue % bytes !== 0) {
    throw new Error(
      `${line}:0 Error: Slice assignment length (${lengthValue}) must be a ` +
        `multiple of the element size (${bytes} bytes) for '${rawName}'.`,
    );
  }

  const value = ctx.generatedValue;
  const elementCount = lengthValue / bytes;
  const writes: string[] = [];
  for (let k = 0; k < elementCount; k += 1) {
    const shiftBits = k * bytes * 8;
    const chunk =
      shiftBits === 0 ? `(${value})` : `(${value} >> ${shiftBits}U)`;
    writes.push(`${name}[${offsetValue + k}] = ${wrap(chunk)};`);
  }

  return writes.join("\n");
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
