/**
 * SPIKE #1431 — THROWAWAY. Deleted before this branch merges.
 *
 * The whole normalized fact set: five tables, no views.
 *
 * Every one of the 63 collections in `ICodeGenSymbols`, `CodeGenState` and
 * `SymbolTable` that is a *view* must be derivable from these five by a query in
 * `Queries`. A collection that cannot be derived is either codegen scratch (not a
 * fact about the program) or dead -- and saying which is the partition this spike
 * reports before it measures anything.
 *
 * Deliberately plain arrays rather than pre-built indices. An index IS a
 * materialized view, and materializing one here would reintroduce the thing under
 * measurement. Query cost is criterion 4's problem, and memoisation is a finding to
 * report rather than a shortcut to take before the baseline exists.
 */
import type ISymbolRow from "./ISymbolRow";
import type IScopeRow from "./IScopeRow";
import type IFileRow from "./IFileRow";
import type IIncludeEdgeRow from "./IIncludeEdgeRow";
import type IMemberRow from "./IMemberRow";

interface IFactStore {
  readonly symbols: readonly ISymbolRow[];
  readonly scopes: readonly IScopeRow[];
  readonly files: readonly IFileRow[];
  readonly includeEdges: readonly IIncludeEdgeRow[];
  readonly members: readonly IMemberRow[];
}

export default IFactStore;
