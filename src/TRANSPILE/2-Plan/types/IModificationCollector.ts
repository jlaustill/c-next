/**
 * What 2.2 Plan accumulates while deriving ADR-006's modification facts.
 *
 * ## Why this exists (#1452)
 *
 * These three maps lived on `CodeGenState` as mutable statics, and the flow
 * around them was circular: 2.2 cleared them and filled them,
 * `ModificationFacts.derive` snapshotted them onto `IProgram`, and then 2.3
 * Render CLEARED THEM AGAIN and re-seeded them from that same artifact before
 * using them as a working set. The authoritative copy was always the one on
 * `IProgram`; the statics were scratch space that two passes shared by
 * accident of being global.
 *
 * Box 4 of #1452 forbids exactly that -- a module reachable from the pipeline
 * holding state written in one pass and read in another. So the collection gets
 * its own object, created by `derive` and discarded when it returns, and 2.3
 * keeps its working copy on the walker rather than in a global both passes can
 * reach.
 *
 * The registry travels with it because the collectors need both and threading
 * two parameters through the same thirteen walker methods would be the same
 * journey twice.
 */
import type ICallGraphEntry from "../../../transpiler/types/ICallGraphEntry";
import type SymbolRegistry from "../../../PARSE/3-Declare/SymbolRegistry";

interface IModificationCollector {
  /** The run's scope graph, for resolving a callee to its declaring scope. */
  readonly registry: SymbolRegistry;

  /** Parameters each function modifies, by transpiled C name. */
  readonly modifiedParameters: Map<string, Set<string>>;

  /** Each function's parameter names, in declaration order. */
  readonly functionParamLists: Map<string, string[]>;

  /** Which functions each function calls, and with what arguments. */
  readonly functionCallGraph: Map<string, ICallGraphEntry[]>;
}

export default IModificationCollector;
