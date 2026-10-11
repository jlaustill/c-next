/**
 * A float literal's parts as written: `1.25e-3f32` is whole "1", fraction
 * "25", exponent -3, width 32, and `1.25e-3` without its suffix. An
 * unsuffixed literal is a C `double`, 64.
 */
interface IFloatLiteralParts {
  readonly unsuffixed: string;
  readonly whole: string;
  readonly fraction: string;
  readonly exponent: number;
  readonly width: 32 | 64;
}

export default IFloatLiteralParts;
