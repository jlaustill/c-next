/**
 * The source side of a slice write `buf[offset, length] <- value` (#1081):
 * the type the value is read as and the temp it is materialized into. 2.2
 * decides it once per slice (#1991) and 2.3 writes it.
 */
import CNX_TO_C_TYPE_MAP from "../../utils/constants/TypeMappings";
import LiteralUtils from "../../utils/LiteralUtils";
import invariant from "../../utils/invariant";
import type TTypeInfo from "../../types/TTypeInfo";
import type IPlannedSliceSource from "./types/IPlannedSliceSource";

/** What the decision reads of the value -- the assignment context's own fields */
interface ISliceValue {
  readonly hasValue: boolean;
  readonly valueExpressionType: () => string | null;
  readonly valueIntegerType: () => string | null;
  readonly foldValue: () => number | undefined;
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
 * Fold a slice source that has no fixed essential category of its own.
 *
 * A bare integer literal types as `int`; a negative literal (unary minus) types
 * as null yet is still a compile-time constant. Both are contextually typed to
 * the slice byte-width (ADR-052), so both are folded here and range-checked.
 * A source that already resolves to a fixed-width type keeps that type and is
 * not folded.
 *
 * @returns the folded value, or undefined when the source is not a
 *          contextually-typed literal or does not evaluate to a constant
 */
function foldContextuallyTypedLiteral(
  directType: string | null,
  value: ISliceValue,
): number | undefined {
  if (!LiteralUtils.isContextuallyTyped(directType) || !value.hasValue) {
    return undefined;
  }
  return value.foldValue();
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
  value: ISliceValue,
  rawName: string,
  lengthValue: number,
): IPlannedSliceSource {
  // A composite source (e.g. `a + b`) is resolved through the Rule 10.4
  // guarantee that its operands share a category, so its essential type is
  // well-defined; `directType` tells us whether the source is composite so the
  // caller can bind it to a same-type temp before the unsigned cast — keeping
  // that cast off the composite itself (MISRA Rule 10.8).
  const directType = value.hasValue ? value.valueExpressionType() : null;

  // A bare integer literal has no fixed essential category; contextually type it
  // to the slice byte-width (ADR-052), with a compile-time fit check. A positive
  // literal types as `int`; a negative literal (unary minus) types as null yet is
  // still a compile-time constant. Fold either so an out-of-range negative is
  // rejected exactly like an out-of-range positive, rather than silently
  // truncated (e.g. buf[0,1] <- -300 -> (uint8_t)(-300)) (Issue #1085 review).
  // A source that resolves to a fixed-width type (variable, struct field, …)
  // keeps that type and is not folded here.
  const literalValue = foldContextuallyTypedLiteral(directType, value);
  if (literalValue !== undefined) {
    return resolveLiteralSliceSource(value, rawName, lengthValue);
  }

  const sourceType =
    directType ?? (value.hasValue ? value.valueIntegerType() : null);

  if (sourceType === null) {
    return {
      cType: null,
      bytes: UNRESOLVED_SOURCE_BYTES,
      unsignedCType: null,
      isComposite: false,
    };
  }

  const isUnsigned = SliceSource.UNSIGNED_INT_RE.test(sourceType);
  const isSigned = SliceSource.SIGNED_INT_RE.test(sourceType);
  if (!isUnsigned && !isSigned) {
    invariant(
      false,
      `a slice source is an integer -- E0861 rejects '${sourceType}' for ` +
        `'${rawName}' in pass 2.1, before this runs`,
    );
  }

  return {
    cType: CNX_TO_C_TYPE_MAP[sourceType],
    bytes: Number.parseInt(sourceType.slice(1), 10) / 8,
    // Signed sources are reinterpreted to their same-width unsigned type so
    // every shift on the materialized temp satisfies MISRA Rule 10.1.
    unsignedCType: isSigned
      ? CNX_TO_C_TYPE_MAP[`u${sourceType.slice(1)}`]
      : CNX_TO_C_TYPE_MAP[sourceType],
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
  value: ISliceValue,
  rawName: string,
  lengthValue: number,
): IPlannedSliceSource {
  const folded = value.hasValue ? value.foldValue() : undefined;
  if (folded !== undefined) {
    // The literal is contextually typed to the slice byte-width (ADR-052), so it
    // must be representable in `length` bytes — either as an unsigned value
    // (0 .. 2^(8N)-1) or as a two's-complement signed value (-2^(8N-1) .. -1).
    // Guarding only the unsigned upper bound let a negative literal of any
    // magnitude through, silently truncating it (e.g. buf[0,1] <- -300 became
    // (uint8_t)(-300)) while the mirror-image positive overflow was rejected
    // (Issue #1085 review). `lengthValue` is already validated > 0 by the caller.
    const truncated = BigInt(Math.trunc(folded));
    const unsignedUpperBound = 1n << BigInt(8 * lengthValue);
    const signedLowerBound = -(1n << BigInt(8 * lengthValue - 1));
    if (truncated >= unsignedUpperBound || truncated < signedLowerBound) {
      invariant(
        false,
        `a slice literal fits its byte width -- E0861 rejects ${folded} in a ` +
          `${lengthValue}-byte slice for '${rawName}' in pass 2.1`,
      );
    }
  }

  const cType = unsignedCTypeForBytes(lengthValue);
  return {
    cType,
    bytes: lengthValue,
    unsignedCType: cType,
    isComposite: false,
  };
}

class SliceSource {
  /** Matches the unsigned C-Next integer types (u8/u16/u32/u64). */
  static readonly UNSIGNED_INT_RE = /^u(8|16|32|64)$/;
  /** Matches the signed C-Next integer types (i8/i16/i32/i64). */
  static readonly SIGNED_INT_RE = /^i(8|16|32|64)$/;

  static of(
    value: ISliceValue,
    rawName: string,
    lengthValue: number,
  ): IPlannedSliceSource {
    return resolveSliceSource(value, rawName, lengthValue);
  }

  /** The destination element's stride in bytes; a string is char[] */
  static elementBytes(typeInfo: TTypeInfo | undefined): number {
    if (typeInfo?.isString) return 1;
    return Math.floor((typeInfo?.bitWidth ?? 0) / 8);
  }

  /** Whether the source is read once into a temp before the writes */
  static materializes(src: IPlannedSliceSource, elementCount: number): boolean {
    return elementCount > 1 || src.isComposite;
  }

  /**
   * Whether a composite signed source binds to its own type first, then is
   * reinterpreted unsigned, keeping the cast off the composite (MISRA 10.8)
   */
  static splits(src: IPlannedSliceSource): boolean {
    return (
      src.isComposite &&
      src.cType !== null &&
      src.unsignedCType !== null &&
      src.cType !== src.unsignedCType
    );
  }

  /** The single temp's type when the source does not split */
  static tempTypeOf(src: IPlannedSliceSource, lengthValue: number): string {
    return src.unsignedCType ?? unsignedCTypeForBytes(lengthValue);
  }
}

export default SliceSource;
