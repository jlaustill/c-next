/**
 * What the per-file modification walk accumulates while collecting ADR-006's
 * facts for one file (#1825). `ModificationCollector` returns it as the
 * file's `IFileModifications`, the read-only view of the same maps.
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
 * its own object, created for one walk and discarded when it returns.
 *
 * ## Why it carries no registry (#1825)
 *
 * It used to, because the walk resolved a bare callee through the run's scope
 * graph. That is a question about every file -- a scope can be reopened in
 * another one (#1333) -- so the walk now records the call as written and 1.4
 * Resolve answers it.
 */
import type IDeclaredCall from "../../../../types/IDeclaredCall";

interface IModificationCollector {
  /** Parameters each function modifies, by transpiled C name. */
  readonly modifiedParameters: Map<string, Set<string>>;

  /** Each function's parameter names, in declaration order. */
  readonly functionParamLists: Map<string, string[]>;

  /** The calls each function passes one of its parameters to, as written. */
  readonly functionCallGraph: Map<string, IDeclaredCall[]>;
}

export default IModificationCollector;
