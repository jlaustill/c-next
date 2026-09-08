/**
 * E0427: a bare identifier in a value position that denotes nothing visible in
 * the file that used it.
 */
interface IUndeclaredValueError {
  readonly code: string;
  readonly identifier: string;
  readonly line: number;
  readonly column: number;
  readonly message: string;
}

export default IUndeclaredValueError;
