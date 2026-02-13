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
        for (const call of calls) {
          const didPropagate = TransitiveModificationPropagator.propagateCall(
            funcName,
            call,
            functionParamLists,
            modifiedParameters,
          );
          if (didPropagate) {
            changed = true;
          }
        }
      }
    }
  }

  /**
   * Check if a single call propagates a modification from callee to caller.
   * Returns true if a new modification was added.
   */
  private static propagateCall(
    callerName: string,
    call: ICallInfo,
    functionParamLists: ReadonlyMap<string, string[]>,
    modifiedParameters: Map<string, Set<string>>,
  ): boolean {
    const { callee, paramIndex, argParamName } = call;

    // Get the callee's parameter list
    const calleeParams = functionParamLists.get(callee);
    if (!calleeParams || paramIndex >= calleeParams.length) {
      return false;
    }

    const calleeParamName = calleeParams[paramIndex];

    // Check if callee modifies this parameter
    if (
      !TransitiveModificationPropagator.isParamModified(
        callee,
        calleeParamName,
        modifiedParameters,
      )
    ) {
      return false;
    }

    // Mark caller's parameter as modified if not already
    return TransitiveModificationPropagator.markParamModified(
      callerName,
      argParamName,
      modifiedParameters,
    );
  }

  /**
   * Check if a function's parameter is in the modified set.
   */
  private static isParamModified(
    funcName: string,
    paramName: string,
    modifiedParameters: ReadonlyMap<string, Set<string>>,
  ): boolean {
    const modified = modifiedParameters.get(funcName);
    return modified?.has(paramName) ?? false;
  }

  /**
   * Mark a function's parameter as modified. Returns true if newly added.
   */
  private static markParamModified(
    funcName: string,
    paramName: string,
    modifiedParameters: Map<string, Set<string>>,
  ): boolean {
    const modified = modifiedParameters.get(funcName);
    if (!modified || modified.has(paramName)) {
      return false;
    }
    modified.add(paramName);
    return true;
  }
}

export default TransitiveModificationPropagator;
