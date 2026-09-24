/**
 * Which functions are used as ADR-029 callbacks, across the whole program.
 *
 * A function assigned to a callback typedef must keep the typedef's parameter
 * shape, so it may not take #268 auto-const or ADR-006 pass-by-value. That makes
 * "is this function used as a callback?" a fact the generated signature depends
 * on — and the use can be in a different file from the declaration, so it is a
 * cross-file fact.
 *
 * It was accumulated instead. `FunctionCallAnalyzer` recorded it as a side
 * effect while analyzing each file during rendering, into a mutable static that
 * `CodeGenState.reset()` deliberately skipped so the entries would survive —
 * which means a file rendered early saw fewer callbacks than one rendered late,
 * and its signatures were decided on a partial answer.
 *
 * #1452 removed the static. The analyzer accumulates into its own map and
 * reports it; this merges what each run found.
 *
 * Derived here over every tree before anything renders. The analyzer is run
 * rather than re-implemented: it is the single owner of the two recognition
 * rules, and a second copy would be free to drift from the one that reports the
 * diagnostics.
 *
 * The analyzer had three global writes, and this pass kept exactly one of them:
 * the callback map, which is what it is run for. That one is no longer global —
 * it is the analyzer's own, merged below — so what remains to reason about is
 * the two this pass DISCARDS. `SymbolRegistry.getOrCreateScope` is idempotent,
 * so calling it earlier only moves when the scope object is built. `AdrProvenance.record("057", …)` is the one that would matter, and it
 * is suppressed BY THE BRACKET BELOW rather than by call order: it currently
 * no-ops only because `beginFile` is first called in stage 5, which is a
 * coincidence of ordering and not a property. Were provenance ever begun
 * earlier — to attribute declare-stage diagnostics, say — this pass would
 * record ADR-057 sites under whatever path was last begun, moving matrix
 * occupancy with nothing failing.
 *
 * So: no global write outlives this pass at all. The callback map is returned
 * rather than left somewhere; diagnostics and provenance are both discarded
 * here, and the per-file run reports them with the per-file context they need.
 *
 * #1544 changed which functions are recognized, which this pass had explicitly
 * left alone. Both recognition rules gated on the functions the USING file
 * declares, so a callback target in another file was missed and took ordinary
 * parameter rules -- emitting a signature that no longer matched the typedef it
 * was assigned to, at transpile exit 0. The first pass below derives what the
 * whole program declares and the writers consult it, so a function is
 * recognized wherever it is declared.
 */

import FunctionCallAnalyzer from "../TRANSPILE/1-Analyze/FunctionCallAnalyzer";
import AdrProvenance from "../instrumentation/AdrProvenance";
import SymbolRegistry from "../PARSE/3-Declare/SymbolRegistry";
import type SymbolTable from "../PARSE/3-Declare/SymbolTable";
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
    registry: SymbolRegistry,
  ): ReadonlyMap<string, string> {
    // Asserted, not inherited from call order: nothing this pass walks is
    // attributable to a file. No restore is needed because every file's render
    // opens with its own `beginFile(sourcePath)`.
    AdrProvenance.beginFile(null);
    // #1544 first pass: what the PROGRAM declares. The map decides a generated
    // signature and the wiring may sit in any file, so recognition needs the
    // same whole-program scope the fact has -- gating it on the using file's
    // own declarations is what made a cross-file callback keep ordinary
    // parameter rules. Built with the analyzer's own encoder, so these keys
    // cannot drift from the ones its writers look up.
    const programFunctions = new Set<string>();
    for (const entry of declared) {
      for (const name of FunctionCallAnalyzer.declaredFunctionNames(
        entry.parsed.tree,
        registry,
      )) {
        programFunctions.add(name);
      }
    }

    // #1452: each run reports what IT recognized, and this merges them. The
    // map used to be a mutable static that every run wrote into and this method
    // snapshotted; merging in the same order gives the same answer -- a later
    // file still wins a key an earlier one set -- without a global between the
    // two collaborators.
    const callbacks = new Map<string, string>();
    for (const entry of declared) {
      // Diagnostics discarded: the per-file run reports them.
      const analyzer = new FunctionCallAnalyzer(programFunctions, registry);
      analyzer.analyze(entry.parsed.tree, symbolTable);
      for (const [name, typedef] of analyzer.callbackCompatibleFunctions()) {
        callbacks.set(name, typedef);
      }
    }
    return callbacks;
  }
}

export default CallbackCompatibility;
