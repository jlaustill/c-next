/**
 * DependencyGraph
 *
 * Manages file dependencies and provides topological sorting for correct
 * processing order. Files are sorted so that dependencies are processed
 * before dependents.
 *
 * Uses @n1ru4l/toposort for cycle-aware topological sorting.
 */

// Handle tsx vs vitest ESM/CJS interop differences:
// - tsx wraps named exports inside `default`
// - vitest exposes named exports at namespace level
import * as toposortNS from "@n1ru4l/toposort";

type ToposortFn = (deps: Map<string, string[]>) => Set<string>[];
type ToposortModule = {
  toposortReverse?: ToposortFn;
  default?: ToposortModule;
};

/**
 * Resolves toposortReverse from module with tsx/vitest interop support.
 */
function resolveToposortReverse(mod: ToposortModule): ToposortFn {
  if (mod.toposortReverse) {
    return mod.toposortReverse;
  }
  return mod.default!.toposortReverse!;
}

const toposortReverse = resolveToposortReverse(toposortNS as ToposortModule);

/**
 * Manages file dependencies for topological sorting
 */
class DependencyGraph {
  /** Maps each file to its dependencies (files it includes) */
  private readonly dependencies: Map<string, string[]> = new Map();
  private readonly warnings: string[] = [];

  /**
   * Resolves toposortReverse with tsx/vitest interop support.
   * Exposed as static for testing both code paths.
   */
  static readonly resolveToposortReverse = resolveToposortReverse;

  /**
   * Add a file to the graph without dependencies
   */
  addFile(path: string): void {
    if (!this.dependencies.has(path)) {
      this.dependencies.set(path, []);
    }
  }

  /**
   * Add a dependency relationship
   * @param dependent - The file that depends on another (the includer)
   * @param dependency - The file being depended on (the included file)
   */
  addDependency(dependent: string, dependency: string): void {
    // Ensure both nodes exist
    if (!this.dependencies.has(dependent)) {
      this.dependencies.set(dependent, []);
    }
    if (!this.dependencies.has(dependency)) {
      this.dependencies.set(dependency, []);
    }

    // Add the dependency relationship
    const deps = this.dependencies.get(dependent)!;
    if (!deps.includes(dependency)) {
      deps.push(dependency);
    }
  }

  /**
   * Get files in topological order (dependencies first)
   *
   * Uses toposortReverse which expects a map of [node -> dependencies].
   * The result is batches of files that can be processed in parallel,
   * but we flatten it to a single array.
   *
   * If a cycle is detected, returns nodes in arbitrary order with a warning.
   */
  getSortedFiles(): string[] {
    if (this.dependencies.size === 0) {
      return [];
    }

    try {
      // toposortReverse returns batches (Set[]) - flatten to array
      const batches = toposortReverse(this.dependencies);
      const result: string[] = [];
      for (const batch of batches) {
        for (const file of batch) {
          result.push(file);
        }
      }
      return result;
    } catch (error) {
      // Cycle detected - return nodes in arbitrary order with warning
      const message = error instanceof Error ? error.message : "unknown error";
      this.warnings.push(
        `Warning: Circular dependency detected in include graph (${message}). Files may be processed in incorrect order.`,
      );
      return [...this.dependencies.keys()];
    }
  }

  /**
   * Get any warnings generated during sorting
   */
  getWarnings(): string[] {
    return [...this.warnings];
  }

  /**
   * Check if the graph has any files
   */
  isEmpty(): boolean {
    return this.dependencies.size === 0;
  }

  /**
   * Get the number of files in the graph
   */
  size(): number {
    return this.dependencies.size;
  }

  /**
   * Every file that transitively includes one of `seeds`, plus the seeds
   * themselves.
   *
   * #1399 review: the undeclared-name diagnostics (E0426/E0427) may only fire
   * where the transpiler knows the file's whole name universe. A C/C++ header
   * is not parsed into the symbol table, and a `#define` in one never reaches
   * it at all, so a file that can see such a header must decline to answer.
   *
   * "Can see" is transitive, and that is the whole point: the first attempt
   * asked only the file's own `#include` lines, so `#include "pins.h"` in your
   * own file disabled the check while reaching the same macro through
   * `#include <board.cnx>` did not -- and that second case then REJECTED a
   * macro `main` compiles. Include visibility does not stop at one hop, so
   * neither can the precondition.
   *
   * Edges are `dependent -> dependencies`, so this walks each candidate's own
   * include closure rather than inverting the graph.
   */
  collectDependentsOf(seeds: ReadonlySet<string>): Set<string> {
    const reaching = new Set<string>();
    const resolved = new Map<string, boolean>();

    const walk = (file: string, visiting: Set<string>): boolean => {
      const cached = resolved.get(file);
      if (cached !== undefined) {
        return cached;
      }
      // A cycle contributes nothing on its own: `false` is the identity for the
      // OR below, and the real answer arrives from whichever branch actually
      // reaches a seed. Include cycles are tolerated with a warning (#1167), so
      // this must terminate rather than assume a DAG.
      if (visiting.has(file)) {
        return false;
      }
      visiting.add(file);

      let result = seeds.has(file);
      if (!result) {
        for (const dep of this.dependencies.get(file) ?? []) {
          if (walk(dep, visiting)) {
            result = true;
            break;
          }
        }
      }

      visiting.delete(file);
      resolved.set(file, result);
      return result;
    };

    for (const file of this.dependencies.keys()) {
      if (walk(file, new Set())) {
        reaching.add(file);
      }
    }
    for (const seed of seeds) {
      reaching.add(seed);
    }
    return reaching;
  }

  /**
   * Clear the graph
   */
  clear(): void {
    this.dependencies.clear();
    this.warnings.length = 0;
  }
}

export default DependencyGraph;
