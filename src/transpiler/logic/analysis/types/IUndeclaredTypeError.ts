/**
 * E0426: a type name that denotes nothing visible in the file that used it.
 */
interface IUndeclaredTypeError {
  readonly code: string;
  readonly typeName: string;
  readonly line: number;
  readonly column: number;
  readonly message: string;
}

export default IUndeclaredTypeError;
