/**
 * 1.4 Resolve — builds `Program` from what every file declared.
 *
 * Declare emits one `IFileSymbols` per file, each computable with only that
 * file's parse tree open. Resolve is the first point at which the whole program
 * exists, so it is the first point at which a cross-file question has an
 * answer. Two things follow, and they are the whole pass:
 *
 *   - the scope-type index, combined from each file's `declaredScopeTypes`,
 *     which is the fact Declare used to be handed as a parameter; and
 *   - settling every `TDeferredType` against it, which is the ADR-057
 *     resolution Declare could not perform.
 *
 * Building and settling are one step on purpose. A `Program` holding unsettled
 * symbols would be an artifact that says "complete" and is not, and every
 * consumer would have to remember to settle first -- the shape that makes an
 * invariant unenforceable.
 *
 * `docs/architecture/symbol-store-prior-art.md` governs the design:
 * normalization as discipline in plain TypeScript, the SQL engine rejected on
 * criterion 3 before its dependency cost, and the raw tables hidden by simply
 * not declaring them on `IProgram`.
 */

import type IFileSymbols from "../../types/IFileSymbols";
import type IProgram from "../../types/IProgram";
import type TSymbol from "../../types/symbols/TSymbol";
import DeferredTypes from "./DeferredTypes";

class Program {
  /**
   * Build the artifact from every declared file.
   *
   * @param files one `IFileSymbols` per file, in declaration order
   */
  static build(files: ReadonlyArray<IFileSymbols>): IProgram {
    // --- the scope-type index -------------------------------------------
    // Combined from per-file answers rather than collected by a pass of its
    // own: Declare authored each file's set, and nothing may recompute a fact
    // an earlier pass owns.
    const scopeTypes = new Set<string>();
    for (const file of files) {
      for (const scopeType of file.declaredScopeTypes) {
        scopeTypes.add(scopeType);
      }
    }
    const isScopeType = (qualifiedName: string): boolean =>
      scopeTypes.has(qualifiedName);

    // --- the symbol table, settled --------------------------------------
    const symbolsByFile = new Map<string, ReadonlyArray<TSymbol>>();
    const symbolsByCName = new Map<string, TSymbol>();

    for (const file of files) {
      const settled = DeferredTypes.settle(file.symbols, isScopeType);

      // The pass's own negative control, checked per file so the message can
      // name one. `TypeResolver.getTypeName` throws on a deferred type, so an
      // escapee would otherwise surface somewhere in codegen with nothing to
      // say about which pass dropped it.
      if (DeferredTypes.hasUnsettled(settled)) {
        throw new Error(
          `Internal error: 1.4 Resolve left a deferred type in ${file.sourceFile}`,
        );
      }

      symbolsByFile.set(file.sourceFile, settled);
      for (const symbol of settled) {
        // First declaration wins, matching the run-wide symbol table's own
        // precedence. A genuine clash is a diagnostic 2.1 owns, not a silent
        // overwrite here.
        if (!symbolsByCName.has(symbol.fullyQualifiedCName)) {
          symbolsByCName.set(symbol.fullyQualifiedCName, symbol);
        }
      }
    }

    const sourceFiles = files.map((file) => file.sourceFile);

    // The query surface. `scopeTypes`, `symbolsByFile` and `symbolsByCName`
    // stay in this closure and are reachable only through the functions below,
    // which is what makes `IProgram` impossible to bypass rather than merely
    // discouraging it.
    return Object.freeze({
      isScopeType,
      symbolByCName: (cName: string): TSymbol | undefined =>
        symbolsByCName.get(cName),
      symbolsInFile: (sourceFile: string): ReadonlyArray<TSymbol> =>
        symbolsByFile.get(sourceFile) ?? [],
      sourceFiles: (): ReadonlyArray<string> => sourceFiles,
    });
  }
}

export default Program;
