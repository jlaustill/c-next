/**
 * ADR-049: what an `atomic` value is read and written as -- the C-Next type
 * (a bitmap's is its backing integer), or null for a C header type with no
 * C-Next name, and its C type. Deciding that a value is atomic does not
 * depend on it having a C-Next name (#2155 review 8).
 */
interface IAtomicAccess {
  readonly typeName: string | null;
  readonly cType: string;
}

export default IAtomicAccess;
