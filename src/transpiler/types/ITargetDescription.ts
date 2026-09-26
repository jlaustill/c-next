/**
 * ADR-049: a target is a complete description of the platform facts the
 * language depends on (schema version 1).
 *
 * The keys are spelled exactly as the catalog's `struct TargetDescription`
 * members and as the description pragmas, so one name means one fact in all
 * three places. `TARGET_DESCRIPTION_FIELDS` is typed over these keys, which is
 * what ties the catalog's struct to this interface: the validator checks the
 * struct's members against that table, and tsc checks the table against this.
 */
interface ITargetDescription {
  readonly name: string;
  /** The widest naturally atomic access, in bits */
  readonly word_size: number;
  /** Exclusive-access read-modify-write instructions exist */
  readonly ldrex_strex: boolean;
  /** Selective interrupt masking exists (ADR-050) */
  readonly basepri: boolean;
  readonly char_bits: number;
  readonly char_signed: boolean;
  readonly short_bits: number;
  readonly int_bits: number;
  readonly long_bits: number;
  readonly long_long_bits: number;
  readonly size_t_bits: number;
  readonly pointer_bits: number;
  readonly float_bits: number;
  readonly double_bits: number;
  /** Storage size, at least `double_bits` */
  readonly long_double_bits: number;
  readonly big_endian: boolean;
  /** MISRA C:2012 Rule 5.1 */
  readonly external_identifier_chars: number;
  /** MISRA C:2012 Rule 5.9 (recorded, not yet enforced: #1338) */
  readonly internal_identifier_chars: number;
  /** A compiler configuration to check generated code against; never changes the program's meaning */
  readonly toolchain_triple?: string;
  /** As `toolchain_triple` */
  readonly toolchain_cpu?: string;
}

export default ITargetDescription;
