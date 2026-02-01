/**
 * Modification Analyzer
 * Issue #593: Dedicated analyzer for C++ mode parameter modification tracking
 *
 * Accumulates function parameter modifications across multiple files for
 * cross-file const inference in C++ mode. This centralizes the accumulation
 * logic that was previously duplicated in Transpiler.
 *
 * Usage:
 * - Call accumulateResults() after analyzing each file
 * - Call getModifications()/getParamLists() to get accumulated state
 * - Call clear() between transpilation runs
 */

/**
 * Result type from CodeGenerator.analyzeModificationsOnly()
 */
interface IAnalysisResult {
  modifications: Map<string, Set<string>>;
  paramLists: Map<string, string[]>;
}

/**
 * Analyzer that tracks parameter modifications across files for C++ const inference.
 *
 * In C++ mode, we need to know which function parameters are modified so we can
 * generate correct const qualifiers. This analyzer accumulates that information
 * as files are processed, enabling cross-file transitive propagation.
 */
class ModificationAnalyzer {
  /**
   * Accumulated parameter modifications across all processed files.
   * Maps function name -> set of modified parameter names.
   */
  private readonly modifications: Map<string, Set<string>> = new Map();

  /**
   * Accumulated function parameter lists across all processed files.
   * Maps function name -> ordered list of parameter names.
   * Used for transitive propagation (mapping call argument indices to param names).
   */
  private readonly paramLists: Map<string, string[]> = new Map();

  /**
   * Accumulate modifications from analysis results.
   * Merges new modifications with existing ones (union of param sets).
   *
   * @param newModifications - Map of function name to modified param names
   */
  accumulateModifications(
    newModifications: ReadonlyMap<string, ReadonlySet<string>>,
  ): void {
    for (const [funcName, params] of newModifications) {
      const existing = this.modifications.get(funcName);
      if (existing) {
        // Merge: add all new params to existing set
        for (const param of params) {
          existing.add(param);
        }
      } else {
        // New function: create new set with copy of params
        this.modifications.set(funcName, new Set(params));
      }
    }
  }

  /**
   * Accumulate param lists from analysis results.
   * Uses first-wins semantics: once a function's param list is recorded,
   * subsequent attempts to set it are ignored.
   *
   * @param newParamLists - Map of function name to parameter name array
   */
  accumulateParamLists(
    newParamLists: ReadonlyMap<string, readonly string[]>,
  ): void {
    for (const [funcName, params] of newParamLists) {
      if (!this.paramLists.has(funcName)) {
        // Only set if not already present (first wins)
        this.paramLists.set(funcName, [...params]);
      }
    }
  }

  /**
   * Convenience method to accumulate both modifications and param lists.
   * This is the typical pattern when processing analysis results.
   *
   * @param results - Analysis results containing both modifications and param lists
   */
  accumulateResults(results: IAnalysisResult): void {
    this.accumulateModifications(results.modifications);
    this.accumulateParamLists(results.paramLists);
  }

  /**
   * Get readonly view of accumulated modifications.
   *
   * @returns Readonly map of function name to readonly set of modified params
   */
  getModifications(): ReadonlyMap<string, ReadonlySet<string>> {
    return this.modifications;
  }

  /**
   * Get readonly view of accumulated param lists.
   *
   * @returns Readonly map of function name to readonly param name array
   */
  getParamLists(): ReadonlyMap<string, readonly string[]> {
    return this.paramLists;
  }

  /**
   * Check if any modifications have been accumulated.
   * Useful for conditional logic in code generation.
   *
   * @returns true if there are any accumulated modifications
   */
  hasModifications(): boolean {
    return this.modifications.size > 0;
  }

  /**
   * Clear all accumulated state.
   * Call this between transpilation runs to reset the analyzer.
   */
  clear(): void {
    this.modifications.clear();
    this.paramLists.clear();
  }
}

export default ModificationAnalyzer;
