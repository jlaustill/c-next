/**
 * Pass-By-Value Analyzer
 *
 * Extracted from CodeGenerator.ts (Issue #269, #558, #566, #579)
 *
 * Answers ADR-006's question for render: is this parameter passed by value?
 * It reads the answer rather than deriving it: `Program.eligibleParameters`
 * decides it once (#1511), from each parameter's declaration (ADR-071 Q6).
 */

import type TranspileState from "../TranspileState";

class PassByValueAnalyzer {
  /**
   * Check if a parameter should be passed by value (by name).
   * Used internally during code generation.
   */
  static isParameterPassByValueByName(
    funcName: string,
    paramName: string,
    state: TranspileState,
  ): boolean {
    // #1511: read, not recomputed -- `Program` decides it once, from the
    // parameter's declaration (ADR-071 Q6).
    const passByValue = state.program?.passByValueParams().get(funcName);
    return passByValue?.has(paramName) ?? false;
  }

  /**
   * Issue #269: Check if a parameter should be passed by value (by index).
   * Part of IOrchestrator interface - used by CallExprGenerator.
   */
  static isParameterPassByValue(
    funcName: string,
    paramIndex: number,
    state: TranspileState,
  ): boolean {
    // #1452: a RENDER-time read, so it asks the artifact. The collector is
    // 1.3's scratch (#1825) and does not exist by the time 2.3 calls this.
    const paramList = state.program?.functionParamLists().get(funcName);
    if (!paramList || paramIndex < 0 || paramIndex >= paramList.length) {
      return false;
    }
    const paramName = paramList[paramIndex];
    return PassByValueAnalyzer.isParameterPassByValueByName(
      funcName,
      paramName,
      state,
    );
  }
}

export default PassByValueAnalyzer;
