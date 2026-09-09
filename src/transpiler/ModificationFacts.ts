/**
 * The whole-program parameter-modification facts.
 *
 * This sits in the orchestration layer because it is the one place both halves
 * are reachable: the collector belongs to 2.2 Plan and the artifact to 1.4
 * Resolve, and `PARSE/` may not import `TRANSPILE/`.
 *
 * Extracted from the transpiler so the test harness can build a `Program` the
 * way production does instead of repeating the sequence. Two spellings of
 * "derive the facts" would be free to drift, and these facts decide generated
 * signatures — #1161's fixture caught exactly that divergence between a `.c`
 * and its `.h` (#1511).
 */

import CodeGenState from "./state/CodeGenState";
import PassByValueAnalyzer from "../TRANSPILE/2-Plan/PassByValueAnalyzer";
import type IFileSymbols from "./types/IFileSymbols";
import type IParsedFile from "./types/IParsedFile";
import type IModificationFacts from "./types/IModificationFacts";
import type ICallGraphEntry from "./types/ICallGraphEntry";

class ModificationFacts {
  /**
   * Derive the parameter-modification facts for the WHOLE program.
   *
   * `PassByValueAnalyzer` collects per tree and propagates transitively through
   * `CodeGenState`'s three maps, so this clears them once, collects from every
   * tree, and propagates once -- which is what makes the result independent of
   * file order. The analyzer stays in 2.2 Plan and is not moved: the
   * orchestrator may import both layers, so no `PARSE -> TRANSPILE` edge is
   * created, and relocating it would falsify #1449's ticked box recording
   * which modules 2-Plan contains.
   *
   * The maps are snapshotted because codegen goes on writing to them while it
   * renders; the artifact must hold what the program said, not what the run has
   * since accumulated.
   */
  static derive(
    declared: ReadonlyArray<{
      readonly parsed: IParsedFile;
      readonly fileSymbols: IFileSymbols;
    }>,
  ): IModificationFacts {
    CodeGenState.modifiedParameters.clear();
    CodeGenState.functionParamLists.clear();
    CodeGenState.functionCallGraph.clear();

    for (const entry of declared) {
      PassByValueAnalyzer.collectFunctionParametersAndModifications(
        entry.parsed.tree,
      );
    }

    // The C-Next symbols are not in the table yet -- `_publishResolvedFile`
    // puts them there, after this. Without them every scope field holding a
    // callback reads as an undeclared function, so #1178's fail-safe fires on
    // the very calls it exists to spare and the parameter is wrongly promoted
    // to a pointer. They are in hand right here, so the predicate is supplied
    // rather than left to depend on when a mutable table happens to be filled.
    const cnextValueCNames = new Set<string>();
    for (const entry of declared) {
      for (const symbol of entry.fileSymbols.symbols) {
        if (symbol.kind === "variable") {
          cnextValueCNames.add(symbol.fullyQualifiedCName);
        }
      }
    }
    PassByValueAnalyzer.propagateModifications(
      (name: string): boolean =>
        cnextValueCNames.has(name) ||
        CodeGenState.symbolTable
          .getOverloadsByCName(name)
          .some((symbol) => symbol.kind === "variable"),
    );

    const modifiedParameters = new Map<string, ReadonlySet<string>>();
    for (const [name, params] of CodeGenState.modifiedParameters) {
      modifiedParameters.set(name, new Set(params));
    }
    const functionParamLists = new Map<string, ReadonlyArray<string>>();
    for (const [name, params] of CodeGenState.functionParamLists) {
      functionParamLists.set(name, [...params]);
    }
    const callGraph = new Map<string, ReadonlyArray<ICallGraphEntry>>();
    for (const [name, calls] of CodeGenState.functionCallGraph) {
      callGraph.set(name, [...calls]);
    }

    return { modifiedParameters, functionParamLists, callGraph };
  }
}

export default ModificationFacts;
