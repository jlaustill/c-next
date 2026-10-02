/**
 * What 1.1 Discover decided for one `#include` directive of a `.cnx` file.
 *
 * #1672: where an include resolves is one decision. 1.1 makes it while it
 * resolves the file's includes and records the answer here, keyed by the
 * directive. 2.1's ADR-010 rules read it and ask the file system nothing.
 * When they asked it themselves, along their own branch between the two
 * forms, their answer could differ from the file the run had discovered:
 * an absolute angle include, and a file that appeared between the two asks.
 */
interface IResolvedInclude {
  /** The file the directive names, as 1.1 resolved it, or null. */
  readonly file: string | null;

  /**
   * ADR-010's E0504 question, answered by the same rule. For an include of a
   * header, the C-Next source spelling (`ext.cnx` for `ext.h`) when the same
   * form of include would find it; otherwise null.
   */
  readonly cnextSource: string | null;
}

export default IResolvedInclude;
