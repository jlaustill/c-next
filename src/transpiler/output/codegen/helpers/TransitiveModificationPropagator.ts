/**
 * TransitiveModificationPropagator
 *
 * Performs fixed-point iteration to propagate parameter modifications
 * transitively through a function call graph. If a parameter is passed to
 * a function that modifies its corresponding parameter, then the caller's
 * parameter is also considered modified.
 *
 * Issue #269: Extracted from CodeGenerator for improved testability.
 */

/**
 * Call info entry in the function call graph.
 * Represents a call from one function to another, tracking which parameter
 * of the caller was passed to which parameter position of the callee.
 */
interface ICallInfo {
  callee: string;
  paramIndex: number;
  argParamName: string;
}

class TransitiveModificationPropagator {
  /**
   * Propagate transitive parameter modifications through the call graph.
   *
   * Uses fixed-point iteration: if a parameter is passed to a function that
   * modifies its corresponding param, then the caller's parameter is also
   * considered modified. This continues until no more changes occur.
   *
   * @param functionCallGraph - Map of function name to call info array
   * @param functionParamLists - Map of function name to parameter name list
   * @param modifiedParameters - Map of function name to modified parameter set (mutated in place)
   */
  static propagate(
    functionCallGraph: ReadonlyMap<string, readonly ICallInfo[]>,
    functionParamLists: ReadonlyMap<string, string[]>,
    modifiedParameters: Map<string, Set<string>>,
  ): void {
    let changed = true;
    while (changed) {
      changed = false;

      for (const [funcName, calls] of functionCallGraph) {
        for (const { callee, paramIndex, argParamName } of calls) {
          // Get the callee's parameter list
          const calleeParams = functionParamLists.get(callee);
          if (!calleeParams || paramIndex >= calleeParams.length) {
            continue;
          }

          const calleeParamName = calleeParams[paramIndex];
          const calleeModified = modifiedParameters.get(callee);

          // If callee's parameter is modified, mark caller's parameter as modified
          if (calleeModified?.has(calleeParamName)) {
            const callerModified = modifiedParameters.get(funcName);
            if (callerModified && !callerModified.has(argParamName)) {
              callerModified.add(argParamName);
              changed = true;
            }
          }
        }
      }
    }
  }
}

export default TransitiveModificationPropagator;
