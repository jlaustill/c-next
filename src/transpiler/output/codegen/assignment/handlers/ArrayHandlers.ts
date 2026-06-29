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
import TypeResolver from "../../TypeResolver";

/** Get typed generator reference */
function gen(): ICodeGenApi {
  return CodeGenState.generator as ICodeGenApi;
}

/** Matches the unsigned C-Next integer types (u8/u16/u32/u64). */
const UNSIGNED_INT_RE = /^u(8|16|32|64)$/;
/** Matches the signed C-Next integer types (i8/i16/i32/i64). */
const SIGNED_INT_RE = /^i(8|16|32|64)$/;

/**
 * Comment emitted above an unrolled slice copy so the generated C is
 * self-documenting (Issue #1081). It is emitted ONLY when the equivalent
 * `memcpy` would actually violate MISRA C:2012 Rule 21.15 — i.e. when the
 * destination element type differs from the source type, so the two `memcpy`
 * pointer arguments would be incompatible. When the types match (`u32[] <- u32`)
 * a `memcpy` would be perfectly compliant, so no rule is cited.
 */
function sliceUnrollComment(
  destCType: string,
  srcCType: string | null,
): string {
  const detail = srcCType
    ? `${destCType}* vs ${srcCType}*`
    : "destination element type vs source type";
  return (
    `/* MISRA C:2012 Rule 21.15: slice copy unrolled to per-element writes ` +
    `(memcpy would pass incompatible pointer types: ${detail}). */`
  );
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
 *  - `cType`: the C element type, used to detect whether an equivalent `memcpy`
 *    would have violated MISRA Rule 21.15 (incompatible pointer types).
 *  - `wrap`: the cast applied to each extracted little-endian chunk. MISRA
 *    Rule 10.8 forbids casting a composite expression (the `>>` result) across
 *    essential-type categories, so `char` and signed destinations cast through
 *    a same-width unsigned type first.
 *
 * Throws for element types that cannot be expressed as integer byte writes
 * (float/bool), which would require type punning and are unsupported.
 */
function resolveSliceElement(
  typeInfo: TTypeInfo | undefined,
  line: number,
  rawName: string,
): { bytes: number; cType: string; wrap: (chunk: string) => string } {
  if (typeInfo?.isString) {
    // string buffers are char[]; cast through uint8_t to satisfy MISRA 10.8.
    return {
      bytes: 1,
      cType: "char",
      wrap: (chunk) => `(char)(uint8_t)${chunk}`,
    };
  }

  const baseType = typeInfo?.baseType ?? "";
  const bytes = Math.floor((typeInfo?.bitWidth ?? 0) / 8);

  if (bytes > 0 && UNSIGNED_INT_RE.test(baseType)) {
    const cType = CNEXT_TO_C_TYPE_MAP[baseType];
    return { bytes, cType, wrap: (chunk) => `(${cType})${chunk}` };
  }

  if (bytes > 0 && SIGNED_INT_RE.test(baseType)) {
    const cType = CNEXT_TO_C_TYPE_MAP[baseType];
    const uType = CNEXT_TO_C_TYPE_MAP[`u${baseType.slice(1)}`];
    return { bytes, cType, wrap: (chunk) => `(${cType})(${uType})${chunk}` };
  }

  throw new Error(
    `${line}:0 Error: Slice assignment is not supported for element type ` +
      `'${baseType}' of '${rawName}'. Only integer and string buffers can be sliced.`,
  );
}

/** Widest source the unroll can serialize when the type can't be resolved. */
const UNRESOLVED_SOURCE_BYTES = 8;

/**
 * Smallest standard unsigned C type that holds `bytes` bytes. Used to size the
 * source temp for an unresolved source to the *slice length* rather than always
 * the widest type — so the materializing cast is same-width (MISRA Rule 10.8
 * forbids casting a composite expression such as `a + b` to a *wider* type).
 */
function unsignedCTypeForBytes(bytes: number): string {
  if (bytes <= 1) return "uint8_t";
  if (bytes <= 2) return "uint16_t";
  if (bytes <= 4) return "uint32_t";
  return "uint64_t";
}

/**
 * Resolve the *source* value's type for a slice assignment (Issue #1081 review).
 *
 * The source is materialized once into an unsigned temp before the writes
 * (`buildSliceWrites`), so this drives the right-hand side of the unrolled copy:
 *  - non-integer sources (float/struct/string) cannot be shifted — reject them
 *    with a clear C-Next error instead of emitting non-compiling C;
 *  - `bytes` lets the caller reject `length > sizeof(source)` (an over-read that
 *    would otherwise emit an undefined out-of-range shift);
 *  - `unsignedCType` is the type of the materialized temp. Shifting that temp
 *    is MISRA Rule 10.1-clean (always unsigned); a signed source is cast to its
 *    same-width unsigned type once, in the temp declaration. It is null when the
 *    source type is unresolved — the caller sizes the temp to the slice length.
 *
 * `cType` is the source's actual C type (used to detect a Rule 21.15 mismatch
 * against the destination element type). When the type can't be statically
 * resolved (e.g. a computed expression or function call), `cType`/`unsignedCType`
 * are null and `bytes` is the widest serializable width (8), so the caller caps
 * the length and sizes the temp from the length to keep the cast Rule 10.8-clean.
 */
function resolveSliceSource(
  ctx: IAssignmentContext,
  line: number,
  rawName: string,
  lengthValue: number,
): {
  cType: string | null;
  bytes: number;
  unsignedCType: string | null;
  isComposite: boolean;
} {
  // A composite source (e.g. `a + b`) is resolved through the Rule 10.4
  // guarantee that its operands share a category, so its essential type is
  // well-defined; `directType` tells us whether the source is composite so the
  // caller can bind it to a same-type temp before the unsigned cast — keeping
  // that cast off the composite itself (MISRA Rule 10.8).
  const directType = ctx.valueCtx
    ? TypeResolver.getExpressionType(ctx.valueCtx)
    : null;

  // A bare integer literal has no fixed essential category (`int`); contextually
  // type it to the slice byte-width (ADR-052), with a compile-time fit check.
  if (directType === "int") {
    return resolveLiteralSliceSource(ctx, line, rawName, lengthValue);
  }

  const sourceType =
    directType ??
    (ctx.valueCtx ? TypeResolver.getIntegerExpressionType(ctx.valueCtx) : null);

  if (sourceType === null) {
    return {
      cType: null,
      bytes: UNRESOLVED_SOURCE_BYTES,
      unsignedCType: null,
      isComposite: false,
    };
  }

  const isUnsigned = UNSIGNED_INT_RE.test(sourceType);
  const isSigned = SIGNED_INT_RE.test(sourceType);
  if (!isUnsigned && !isSigned) {
    throw new Error(
      `${line}:0 Error: Slice assignment source must be an integer value; ` +
        `the value assigned to '${rawName}' has type '${sourceType}'.`,
    );
  }

  return {
    cType: CNEXT_TO_C_TYPE_MAP[sourceType],
    bytes: Number.parseInt(sourceType.slice(1), 10) / 8,
    // Signed sources are reinterpreted to their same-width unsigned type so
    // every shift on the materialized temp satisfies MISRA Rule 10.1.
    unsignedCType: isSigned
      ? CNEXT_TO_C_TYPE_MAP[`u${sourceType.slice(1)}`]
      : CNEXT_TO_C_TYPE_MAP[sourceType],
    isComposite: directType === null,
  };
}

/**
 * Resolve a bare integer-literal slice source (Issue #1085 review, Finding D).
 *
 * A literal has no fixed essential category, so it is contextually typed to the
 * slice byte-width (ADR-052): a `length`-byte slice serializes the literal as an
 * unsigned value of that width. The literal must fit in `length` bytes, else a
 * clear compile error — `buf[0,2] <- 0x12345678` cannot hold a 4-byte value.
 */
function resolveLiteralSliceSource(
  ctx: IAssignmentContext,
  line: number,
  rawName: string,
  lengthValue: number,
): {
  cType: string | null;
  bytes: number;
  unsignedCType: string | null;
  isComposite: boolean;
} {
  const value = ctx.valueCtx
    ? gen().tryEvaluateConstant(ctx.valueCtx)
    : undefined;
  if (
    value !== undefined &&
    BigInt(Math.trunc(value)) >= 1n << BigInt(8 * lengthValue)
  ) {
    throw new Error(
      `${line}:0 Error: Slice assignment literal value (${value}) does not fit ` +
        `in the ${lengthValue}-byte slice for '${rawName}'.`,
    );
  }

  const cType = unsignedCTypeForBytes(lengthValue);
  return {
    cType,
    bytes: lengthValue,
    unsignedCType: cType,
    isComposite: false,
  };
}

/**
 * Validate a slice's length/bounds against the destination element size and
 * buffer capacity, and return the number of destination elements written.
 *
 * `offset` is an *element* index and `capacity` is an *element* count, while
 * `length` is a *byte* count — so the bounds check compares element spans
 * (`offset + elementCount`), not bytes against elements (Issue #1085 review,
 * Finding 1). Mixing the two wrongly rejected in-bounds wide-element slices.
 */
function validateSliceSpan(
  dest: { bytes: number },
  src: { bytes: number },
  offsetValue: number,
  lengthValue: number,
  capacity: number,
  line: number,
  rawName: string,
): number {
  if (lengthValue % dest.bytes !== 0) {
    throw new Error(
      `${line}:0 Error: Slice assignment length (${lengthValue}) must be a ` +
        `multiple of the element size (${dest.bytes} bytes) for '${rawName}'.`,
    );
  }

  const elementCount = lengthValue / dest.bytes;
  if (offsetValue + elementCount > capacity) {
    throw new Error(
      `${line}:0 Error: Slice assignment out of bounds: ` +
        `offset(${offsetValue}) + ${elementCount} element(s) = ` +
        `${offsetValue + elementCount} exceeds buffer capacity(${capacity}) ` +
        `for '${rawName}'.`,
    );
  }

  // A slice cannot copy more bytes than the source value holds — that would be
  // an out-of-range shift (undefined behavior) baked in at compile time.
  if (lengthValue > src.bytes) {
    throw new Error(
      `${line}:0 Error: Slice assignment length (${lengthValue} bytes) exceeds ` +
        `the source value width (${src.bytes} bytes) for '${rawName}'.`,
    );
  }

  return elementCount;
}

/**
 * Materialize a slice source into a single unsigned temp that the unrolled
 * writes shift to extract each element. The source is read exactly once and
 * every shift operates on a known-width unsigned value (MISRA Rule 10.1).
 *
 * A *composite signed* source (e.g. `a + b` of signed operands) is split into
 * two steps — bind it to its own signed type, then reinterpret that simple
 * identifier to unsigned — so the unsigned cast never applies to the composite
 * expression (MISRA Rule 10.8). Every other source keeps the single same-or-
 * length-sized cast it had before: a same-category cast (resolved unsigned) or
 * a non-composite cast (simple source / function call) does not trip Rule 10.8.
 */
function materializeSliceSource(
  writes: string[],
  src: {
    cType: string | null;
    unsignedCType: string | null;
    isComposite: boolean;
  },
  value: string,
  lengthValue: number,
): string {
  if (
    src.isComposite &&
    src.cType !== null &&
    src.unsignedCType !== null &&
    src.cType !== src.unsignedCType
  ) {
    const signedName = CodeGenState.getNextTempVarName();
    writes.push(`const ${src.cType} ${signedName} = ${value};`);
    const unsignedName = CodeGenState.getNextTempVarName();
    writes.push(
      `const ${src.unsignedCType} ${unsignedName} = (${src.unsignedCType})${signedName};`,
    );
    return unsignedName;
  }

  const tempType = src.unsignedCType ?? unsignedCTypeForBytes(lengthValue);
  const tempName = CodeGenState.getNextTempVarName();
  writes.push(`const ${tempType} ${tempName} = (${tempType})(${value});`);
  return tempName;
}

/**
 * Build the unrolled, per-element little-endian writes for a slice assignment
 * (Issue #1081). Offset/length constants are already validated by the caller;
 * this focuses on the destination-element-aware codegen so `handleArraySlice`
 * stays within the cognitive-complexity budget.
 *
 * The source is materialized into a single unsigned temp before the writes so
 * it is evaluated exactly once — an impure source (function call, atomic read)
 * would otherwise be re-evaluated per element (Issue #1085 review, Finding 2) —
 * and so every shift has a known, in-range width (Finding 3). The temp is
 * skipped for a single-element slice, where the source is used only once.
 */
function buildSliceWrites(
  name: string,
  ctx: IAssignmentContext,
  typeInfo: TTypeInfo | undefined,
  offsetValue: number,
  lengthValue: number,
  capacity: number,
  line: number,
  rawName: string,
): string {
  const dest = resolveSliceElement(typeInfo, line, rawName);
  const src = resolveSliceSource(ctx, line, rawName, lengthValue);
  const elementCount = validateSliceSpan(
    dest,
    src,
    offsetValue,
    lengthValue,
    capacity,
    line,
    rawName,
  );

  const writes: string[] = [];
  // Self-document the codegen ONLY when a memcpy would actually have violated
  // Rule 21.15 (source/destination pointer types differ). Same-type slices need
  // no rule citation (Issue #1081 review).
  if (src.cType === null || src.cType !== dest.cType) {
    writes.push(sliceUnrollComment(dest.cType, src.cType));
  }

  // Evaluate the source once. Shifting a single unsigned temp keeps every chunk
  // MISRA Rule 10.1-clean and reads the source exactly once — needed when the
  // source feeds more than one element, or whenever it is a composite (so the
  // unsigned cast lands on the temp, never on the composite: MISRA Rule 10.8).
  // Residual: an *unresolved* composite (e.g. a struct-field or function-call
  // expression TypeResolver cannot type) is still sized to the slice length and
  // cast directly — see issue #1089.
  let sourceExpr = ctx.generatedValue;
  if (elementCount > 1 || src.isComposite) {
    sourceExpr = materializeSliceSource(
      writes,
      src,
      ctx.generatedValue,
      lengthValue,
    );
  }

  for (let k = 0; k < elementCount; k += 1) {
    const shiftBits = k * dest.bytes * 8;
    const chunk =
      shiftBits === 0 ? `(${sourceExpr})` : `(${sourceExpr} >> ${shiftBits}U)`;
    writes.push(`${name}[${offsetValue + k}] = ${dest.wrap(chunk)};`);
  }

  return writes.join("\n");
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
  // granularity with no library call. Element-span bounds, source-width, and
  // length-alignment are validated inside buildSliceWrites where the element
  // size is known.
  return buildSliceWrites(
    name,
    ctx,
    typeInfo,
    offsetValue,
    lengthValue,
    capacity,
    line,
    ctx.identifiers[0],
  );
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
