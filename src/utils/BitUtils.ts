/**
 * The storage's width, from its fixed-width C type: `uint32_t`, `int16_t`, ...
 * A type this does not name (`bool`, or none known) has no width here.
 */
const FIXED_WIDTH = /^u?int(8|16|32|64)_t$/;

/** A bit width written as a constant: `24`, or `24U` once suffixed */
const CONSTANT_WIDTH = /^(\d+)U?$/;

/**
 * Bit manipulation utilities for C code generation: the one rule for
 * writing a bit or a bit range of an integer, whatever names it -- a
 * variable, a bitmap field, a register member, or a float's bits.
 *
 * Every write takes its storage's C type, because two decisions depend on
 * it (#1668):
 * - an operand shifted into storage wider than 16 bits is cast to the
 *   storage's own unsigned width first. C promises `unsigned int` only 16
 *   bits, and where it is 16 bits (AVR) `1U << 16` is undefined and
 *   `~(1U << 3)` is a 16-bit mask that clears bits 16-31 of the storage it
 *   is ANDed with -- a silent miscompile that compiles cleanly. A
 *   fixed-width type is exact on every target, so the output is too;
 * - storage narrower than 32 bits takes the MISRA C:2012 Rule 10.3 cast
 *   back to its type, since the operators promote.
 *
 * Any other named storage is an integer whose width the target does not fix
 * (`int_fast16_t`, which is `long` on a 64-bit host): the typer gives it no
 * width, and only such a type is passed here by name. Its write is worked in
 * `uintmax_t` and cast back to the storage type (owner ruling, #1760 review),
 * which is correct at any width and the same on every target. A 32-bit `1U`
 * mask there cleared the upper half of a 64-bit `long`.
 */
class BitUtils {
  /**
   * Convert a boolean expression to an unsigned integer (0U or 1U).
   * Handles literal "true"/"false" and generates ternary for expressions.
   * Uses unsigned literals for MISRA C:2012 Rule 10.1 compliance.
   *
   * @param expr - The expression to convert
   * @returns C code string representing the unsigned integer value
   */
  static boolToInt(expr: string): string {
    if (expr === "true") return "1U";
    if (expr === "false") return "0U";
    return `(${expr} ? 1U : 0U)`;
  }

  /**
   * The mask of `width` ones. A constant width is written as its value, a
   * hex literal C sizes to fit on every target; only a width known at run
   * time is computed, in the storage's width.
   *
   * @param width - The bit width (number, or the generated C for it)
   * @param storage - The C type of the value masked, when known
   * @returns C code string for the mask
   */
  static generateMask(width: string | number, storage?: string): string {
    const constant = CONSTANT_WIDTH.exec(String(width));
    if (constant) {
      return BitUtils.maskHex(Number(constant[1]));
    }
    return `((${BitUtils.widen("1U", storage)} << ${width}) - 1U)`;
  }

  /**
   * The hex literal of `width` ones, e.g. 4 -> `0xFU`, 64 ->
   * `0xFFFFFFFFFFFFFFFFU`. The `U` suffix is MISRA C:2012 Rule 7.2's.
   *
   * @param width - The bit width, 0 to 64
   * @returns Hex mask string
   */
  static maskHex(width: number): string {
    const ones = (1n << BigInt(width)) - 1n;
    return `0x${ones.toString(16).toUpperCase()}U`;
  }

  /**
   * Generate read-modify-write code for single bit assignment.
   * Pattern: target = (target & ~(1 << offset)) | (value << offset)
   * Converts boolean values via boolToInt.
   *
   * @param target - The variable to modify
   * @param offset - Bit position (0-indexed)
   * @param value - Value to write (will be converted via boolToInt)
   * @param storage - The target's C type, when known
   * @returns C code string for the assignment
   */
  static singleBitWrite(
    target: string,
    offset: string | number,
    value: string,
    storage?: string,
  ): string {
    const one = BitUtils.widen("1U", storage);
    const bit = BitUtils.widen(BitUtils.boolToInt(value), storage);
    const rhs = `(${target} & ~(${one} << ${offset})) | (${bit} << ${offset})`;
    return BitUtils.assign(target, rhs, storage);
  }

  /**
   * Generate read-modify-write code for multi-bit assignment.
   * Pattern: target = (target & ~(mask << offset)) | ((value & mask) << offset)
   *
   * @param target - The variable to modify
   * @param offset - Starting bit position (0-indexed)
   * @param width - Number of bits to write
   * @param value - Value to write
   * @param storage - The target's C type, when known
   * @returns C code string for the assignment
   */
  static multiBitWrite(
    target: string,
    offset: string | number,
    width: string | number,
    value: string,
    storage?: string,
  ): string {
    const mask = BitUtils.shiftedMask(width, storage);
    const rhs = `(${target} & ~(${mask} << ${offset})) | ((${value} & ${mask}) << ${offset})`;
    return BitUtils.assign(target, rhs, storage);
  }

  /**
   * Generate write-only register code for single bit assignment.
   * No read-modify-write, just shifts the value into position.
   * Pattern: target = (value << offset)
   *
   * @param target - The register to write
   * @param offset - Bit position (0-indexed)
   * @param value - Value to write (will be converted via boolToInt)
   * @param storage - The target's C type, when known
   * @returns C code string for the assignment
   */
  static writeOnlySingleBit(
    target: string,
    offset: string | number,
    value: string,
    storage?: string,
  ): string {
    const bit = BitUtils.widen(BitUtils.boolToInt(value), storage);
    return `${target} = ${BitUtils.narrowCast(storage)}(${bit} << ${offset});`;
  }

  /**
   * Generate write-only register code for multi-bit assignment.
   * No read-modify-write, just shifts the masked value into position.
   * Pattern: target = ((value & mask) << offset)
   *
   * @param target - The register to write
   * @param offset - Starting bit position (0-indexed)
   * @param width - Number of bits to write
   * @param value - Value to write
   * @param storage - The target's C type, when known
   * @returns C code string for the assignment
   */
  static writeOnlyMultiBit(
    target: string,
    offset: string | number,
    width: string | number,
    value: string,
    storage?: string,
  ): string {
    const mask = BitUtils.shiftedMask(width, storage);
    const cast = BitUtils.narrowCast(storage);
    return `${target} = ${cast}((${value} & ${mask}) << ${offset});`;
  }

  /** A mask about to be shifted into `storage`: a computed one already is */
  private static shiftedMask(
    width: string | number,
    storage: string | undefined,
  ): string {
    const mask = BitUtils.generateMask(width, storage);
    return CONSTANT_WIDTH.test(String(width))
      ? BitUtils.widen(mask, storage)
      : mask;
  }

  /** An operand shifted into `storage`, in the storage's width (see above) */
  private static widen(operand: string, storage: string | undefined): string {
    if (BitUtils.isUnfixed(storage)) return `(uintmax_t)${operand}`;
    const bits = BitUtils.bitsOf(storage);
    return bits > 16 ? `(uint${bits}_t)${operand}` : operand;
  }

  /** A read-modify-write's assignment, cast back as `narrowCast` says */
  private static assign(
    target: string,
    rhs: string,
    storage: string | undefined,
  ): string {
    const cast = BitUtils.narrowCast(storage);
    if (cast === "") {
      return `${target} = ${rhs};`;
    }
    return `${target} = ${cast}(${rhs});`;
  }

  /**
   * The Rule 10.3 cast back to storage narrower than 32 bits, or to storage
   * of unfixed width, which is worked in `uintmax_t`; none otherwise
   */
  private static narrowCast(storage: string | undefined): string {
    if (BitUtils.isUnfixed(storage)) return `(${storage})`;
    const bits = BitUtils.bitsOf(storage);
    return bits > 0 && bits < 32 ? `(${storage})` : "";
  }

  /** Storage named by a type whose width the target does not fix */
  private static isUnfixed(storage: string | undefined): boolean {
    return storage !== undefined && !FIXED_WIDTH.test(storage);
  }

  /** The storage's width in bits, or 0 when its type is not fixed-width */
  private static bitsOf(storage: string | undefined): number {
    const match = FIXED_WIDTH.exec(storage ?? "");
    return match ? Number(match[1]) : 0;
  }
}

export default BitUtils;
