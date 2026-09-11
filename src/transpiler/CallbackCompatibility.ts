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
 * diagnostics.
 *
 * The analyzer has three global writes, and this pass keeps exactly one of
 * them. The callback map is what it is run for. `SymbolRegistry.getOrCreateScope`
 * is idempotent, so calling it earlier only moves when the scope object is
 * built. `AdrProvenance.record("057", …)` is the one that would matter, and it
 * is suppressed BY THE BRACKET BELOW rather than by call order: it currently
 * no-ops only because `beginFile` is first called in stage 5, which is a
 * coincidence of ordering and not a property. Were provenance ever begun
 * earlier — to attribute declare-stage diagnostics, say — this pass would
 * record ADR-057 sites under whatever path was last begun, moving matrix
 * occupancy with nothing failing.
 *
 * So: the only global write that OUTLIVES this pass is the callback map.
 * Diagnostics and provenance are both discarded here, and the per-file run
 * reports them with the per-file context they need.
 *
 * What this does NOT change is which functions are recognized. Both recognition
 * rules gate on the functions the USING file declares, so a callback target in
 * another file is still missed; that is a semantic change with its own fixtures
 * and is tracked as #1544.
 */

import FunctionCallAnalyzer from "../TRANSPILE/1-Analyze/FunctionCallAnalyzer";
import AdrProvenance from "./state/AdrProvenance";
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
    // Asserted, not inherited from call order: nothing this pass walks is
    // attributable to a file. No restore is needed because every file's render
    // opens with its own `beginFile(sourcePath)`.
    AdrProvenance.beginFile(null);
    for (const entry of declared) {
      // Diagnostics discarded: the per-file run reports them.
      new FunctionCallAnalyzer().analyze(entry.parsed.tree, symbolTable);
    }
    return new Map(CodeGenState.callbackCompatibleFunctions);
  }
}

export default CallbackCompatibility;
