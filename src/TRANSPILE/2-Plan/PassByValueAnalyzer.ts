/**
 * Pass-By-Value Analyzer
 *
 * Extracted from CodeGenerator.ts (Issue #269, #558, #566, #579)
 *
 * Answers ADR-006's question for render: is this parameter passed by value?
 * It reads the answer rather than deriving it. Eligibility needs to know
 * whether the parameter is modified anywhere down the call chain, which
 * crosses files, so `Program.eligibleParameters` derives it once (#1511) from
 * the facts 1.4's `ModificationFacts` propagates.
 *
 * #1825: this module also held the collection walk those facts start from,
 * which needs one file's parse tree and nothing else. It moved to 1.3 Declare
 * (`ModificationCollector`), and the propagation with its callee resolver to
 * 1.4 Resolve. What is left is the render-time query.
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
    // #1511: read, not recomputed. This used to consult a map that
    // `analyze(tree)` rebuilt PER FILE -- clearing it first, so the whole-program
    // answer was discarded and re-derived from one file plus whatever had been
    // injected. Eligibility depends on whether anything downstream modifies the
    // parameter, which is a property of the call chain and not of a file.
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
