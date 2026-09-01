/**
 * SPIKE #1431 — THROWAWAY. Deleted before this branch merges.
 *
 * One row of the `file` table.
 */
interface IFileRow {
  /** PRIMARY KEY: the resolved absolute path. */
  readonly path: string;

  /** "cnx" | "c-header" | "cpp-header". */
  readonly language: string;

  /**
   * Position in `DependencyGraph.getSortedFiles()`. Exists ONLY so the `run_so_far`
   * predicate can be reproduced -- it is the artifact D9 is made of, not a fact
   * about the program. A whole-program query has no use for it, which is the point.
   */
  readonly topoIndex: number;

  /**
   * Whether this file can see a C/C++ header, transitively. `DependencyGraph.ts:137`
   * records why this is a precondition for E0426/E0427: a macro in a foreign header
   * never reaches the symbol table, so a file that can see one must decline to answer.
   */
  readonly reachesForeignHeader: boolean;
}

export default IFileRow;
