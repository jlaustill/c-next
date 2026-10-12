/**
 * What the place a value stands in says about it (#1322, #1991): a
 * declaration's type, the field it initializes, the parameter it is passed to,
 * an assignment's target or the enclosing function's return type.
 */
interface IValuePosition {
  /** The type's spelling; null when the position cannot name one */
  readonly typeText: string | null;
  /** Whether the position takes a whole array */
  readonly isArray: boolean;
  /** A declaration, whose whole-array initializer ADR-035's rule checks */
  readonly isDeclaration: boolean;
  /** Whether an array initializer stands between the value and the position */
  readonly inList: boolean;
  /** False where nothing establishes a type, as under a subscript (E0357) */
  readonly supplied: boolean;
}

export default IValuePosition;
