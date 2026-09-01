/**
 * SPIKE #1431 — THROWAWAY. Deleted before this branch merges.
 *
 * The six "scopes" of #1431, written as what they actually are: one query over
 * `IFactStore` with different predicates.
 *
 * | #1431's scope                | predicate here                      |
 * | ---------------------------- | ----------------------------------- |
 * | this file's parse tree only  | `declaredIn(f)`                     |
 * | per-file include-visible     | `visibleFrom(f)`                    |
 * | run-wide                     | `runWide()`                         |
 * | run-so-far                   | `runSoFar(i)` -- reproduced, not endorsed |
 * | per-generate-call            | NOT A SCOPE. An orthogonal phase axis; see the note below. |
 * | cross-run persisted          | not observable in one run; needs a cold/warm pair. |
 *
 * `runSoFar` exists only to REPRODUCE D9, so the probe can show that the run-wide
 * answer and the run-so-far answer differ. It takes a `topoIndex`, which is a
 * property of the traversal and not of the program -- that is the argument for
 * calling it an artifact rather than a scope.
 *
 * There is no `perGenerateCall` predicate and there cannot be one. That axis is
 * "which pass has run so far", not "which symbols are in view", so it is not
 * expressible as a WHERE clause over these tables at all. #1430 is what it looks
 * like when the two axes are confused.
 */
import type IFactStore from "./types/IFactStore";
import type ISymbolRow from "./types/ISymbolRow";

class Queries {
  /**
   * Every file `from` can see, transitively, EXCLUDING `from` itself.
   *
   * This is the join #1398 reports as missing: `DependencyGraph` holds the edges and
   * symbols carry `sourceFile`, and "both halves exist and are not connected".
   *
   * Cycle handling is the interesting part. `DependencyGraph.collectDependentsOf`
   * memoises a `false` computed while an ancestor is still on the stack, so a node
   * reaching a seed only through the cycle caches as not-reaching. A closure computed
   * to a fixed point cannot have that bug, because it never commits a node's answer
   * while the answer is still growing. Include cycles are tolerated with a warning
   * (#1167), so terminating on one is a requirement rather than an edge case.
   */
  static includeClosure(store: IFactStore, from: string): ReadonlySet<string> {
    const direct = new Map<string, string[]>();
    for (const edge of store.includeEdges) {
      const existing = direct.get(edge.dependent);
      if (existing) {
        existing.push(edge.dependency);
      } else {
        direct.set(edge.dependent, [edge.dependency]);
      }
    }

    const reached = new Set<string>();
    const pending: string[] = [...(direct.get(from) ?? [])];
    while (pending.length > 0) {
      const next = pending.pop()!;
      if (next === from || reached.has(next)) {
        continue;
      }
      reached.add(next);
      for (const dep of direct.get(next) ?? []) {
        pending.push(dep);
      }
    }
    return reached;
  }

  /** WHERE source_file = ? -- what this file DECLARES. Not what it can see. */
  static declaredIn(store: IFactStore, file: string): readonly ISymbolRow[] {
    return store.symbols.filter((s) => s.sourceFile === file);
  }

  /**
   * WHERE source_file IN (closure of ?) -- what this file CAN SEE.
   *
   * `_declareFile(tree, path, file.cnextIncludes)` builds the live per-file view from
   * the same predicate, so this is the query that view is a materialization of.
   */
  static visibleFrom(store: IFactStore, file: string): readonly ISymbolRow[] {
    const closure = Queries.includeClosure(store, file);
    return store.symbols.filter(
      (s) => s.sourceFile === file || closure.has(s.sourceFile),
    );
  }

  /**
   * Whether `path` participates in the include-edge graph at all.
   *
   * Only `.cnx` files do. A header is in NEITHER dependency graph the run builds --
   * `Transpiler._buildPipelineInput`'s holds `.cnx -> .cnx` and
   * `IncludeResolver.resolveHeadersTransitively:309`'s holds header -> header, and
   * neither spans the two. So "can this file see that header type?" has no derivation,
   * and an observation whose answer depends on one must be reported NOT DERIVABLE
   * rather than as a divergence.
   *
   * This is not a nicety. Without it, 530 of 2843 `isKnownStruct` observations read as
   * divergences; every one of them is a header-declared type (`CanMessage` is a C++
   * `class` in a `.h`, `Rectangle` a C `struct` in `structs.h`) whose principled
   * answer was false only because the edge that would make it true does not exist.
   * That would have been the headline number, and it would have been an artifact.
   */
  static fileIsInGraph(store: IFactStore, path: string): boolean {
    for (const edge of store.includeEdges) {
      if (edge.dependent === path || edge.dependency === path) {
        return true;
      }
    }
    return store.files.some((f) => f.path === path);
  }

  /** No predicate. What `SymbolTable` answers, having accumulated the whole run. */
  static runWide(store: IFactStore): readonly ISymbolRow[] {
    return store.symbols;
  }

  /**
   * WHERE topological_index < ? -- the D9 artifact, reproduced so it can be shown to
   * differ from `runWide`. Correct only under a valid topological order, and an
   * include cycle makes `getSortedFiles()` return insertion order with a warning.
   */
  static runSoFar(store: IFactStore, topoIndex: number): readonly ISymbolRow[] {
    const byPath = new Map(store.files.map((f) => [f.path, f.topoIndex]));
    return store.symbols.filter((s) => {
      const index = byPath.get(s.sourceFile);
      return index !== undefined && index < topoIndex;
    });
  }
}

export default Queries;
