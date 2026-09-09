/**
 * Which functions are used as ADR-029 callbacks, across the whole program.
 *
 * A function assigned to a callback typedef must keep the typedef's parameter
 * shape, so it may not take #268 auto-const or ADR-006 pass-by-value. That makes
 * "is this function used as a callback?" a fact the generated signature depends
 * on — and the use can be in a different file from the declaration, so it is a
 * cross-file fact.
 *
 * It was accumulated instead. `FunctionCallAnalyzer` records it as a side effect
 * while analyzing each file during rendering, and `CodeGenState.reset()` does
 * not clear it between files precisely so the entries survive — which means a
 * file rendered early saw fewer callbacks than one rendered late, and its
 * signatures were decided on a partial answer.
 *
 * Derived here over every tree before anything renders. The analyzer is run
 * rather than re-implemented: it is the single owner of the two recognition
 * rules, and a second copy would be free to drift from the one that reports the
 * diagnostics. Its diagnostics are discarded on this pass — the per-file run
 * still reports them, with the per-file context they need — and that is safe
 * because populating this map is its ONLY global side effect. Verified, not
 * assumed: `CodeGenState.<x> =`, `.set(`, `.add(`, `.clear(` and `.delete(`
 * across `FunctionCallAnalyzer` match exactly the two writes to this map.
 *
 * What this does NOT change is which functions are recognized. Both recognition
 * rules gate on the functions the USING file declares, so a callback target in
 * another file is still missed; that is a semantic change with its own fixtures
 * and is tracked as #1544.
 */

import FunctionCallAnalyzer from "../TRANSPILE/1-Analyze/FunctionCallAnalyzer";
import CodeGenState from "./state/CodeGenState";
import type SymbolTable from "./state/SymbolTable";
import type IParsedFile from "./types/IParsedFile";

class CallbackCompatibility {
  /**
   * @param declared every file's parse, in declaration order
   * @param symbolTable the accumulated table the analyzer consults
   * @returns function name to the callback typedef it is used as
   */
  static derive(
    declared: ReadonlyArray<{ readonly parsed: IParsedFile }>,
    symbolTable: SymbolTable,
  ): ReadonlyMap<string, string> {
    CodeGenState.callbackCompatibleFunctions = new Map();
    for (const entry of declared) {
      // Diagnostics discarded: the per-file run reports them.
      new FunctionCallAnalyzer().analyze(entry.parsed.tree, symbolTable);
    }
    return new Map(CodeGenState.callbackCompatibleFunctions);
  }
}

export default CallbackCompatibility;
