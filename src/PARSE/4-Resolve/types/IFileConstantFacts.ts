/**
 * What a constant name's facts read of the program's files, beside the binder
 * (#1175): the same two answers for 1.4's settling and every later pass.
 */
interface IFileConstantFacts {
  /** ADR-057: whether a qualified type name is a scope type `sourceFile` sees */
  isScopeTypeVisibleFrom(sourceFile: string, qualifiedName: string): boolean;
  /** Whether `sourceFile` includes a C or C++ header, so a name may be a macro */
  reachesForeignHeader(sourceFile: string): boolean;
}

export default IFileConstantFacts;
