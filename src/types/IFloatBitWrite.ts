import type IBitWidth from "./IBitWidth";

/**
 * A float bit write (ADR-007): the float written, its type, and the bits
 * written into it. #1760: one argument, where it was six.
 */
interface IFloatBitWrite {
  /** The float written, as C: a variable's name, or an lvalue */
  readonly target: string;
  /** Its C-Next type, `f32` or `f64`, as the typer gives it */
  readonly floatType: string;
  /** Bit index expression (the start position of a range) */
  readonly bitIndex: string;
  /** Bit width with its fold (#1096), or null for a single bit */
  readonly width: IBitWidth | null;
  /** The value written */
  readonly value: string;
  /** Whether `target` names a variable, which has a shadow union */
  readonly isVariable: boolean;
}

export default IFloatBitWrite;
