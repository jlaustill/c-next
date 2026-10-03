/**
 * ADR-049: what one target-description field may hold.
 */
interface ITargetFieldSpec {
  readonly kind: "unsigned" | "boolean" | "string";
  /** Only the toolchain fields may be left out */
  readonly optional: boolean;
  /** The values an unsigned field may take, when the schema lists them */
  readonly allowed?: readonly number[];
  /** The smallest value an unsigned field may take, when the schema bounds it */
  readonly min?: number;
}

export default ITargetFieldSpec;
