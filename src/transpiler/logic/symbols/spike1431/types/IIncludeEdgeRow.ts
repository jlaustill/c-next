/**
 * SPIKE #1431 — THROWAWAY. Deleted before this branch merges.
 *
 * One row of the `include_edge` table -- a DIRECT include, `dependent -> dependency`.
 *
 * This is the table #1398 says already exists and is not connected to anything:
 * `DependencyGraph.dependencies` holds exactly these edges. It is also, today,
 * DISCARDED -- the graph is a local in `Transpiler._buildPipelineInput` and dies
 * when discovery flattens it to a sorted list, after which the include closure is
 * recomputed from disk with `readFileSync` twice more per file per run.
 *
 * Transitivity is NOT stored. It is the recursive query in `Queries.visibleFrom`,
 * which is the join the codebase never wrote.
 */
interface IIncludeEdgeRow {
  /** FOREIGN KEY -> file.path. The includer. */
  readonly dependent: string;

  /** FOREIGN KEY -> file.path. The included file. */
  readonly dependency: string;

  /** Whether the edge came from a `.cnx` include or a C/C++ header include. */
  readonly kind: string;
}

export default IIncludeEdgeRow;
