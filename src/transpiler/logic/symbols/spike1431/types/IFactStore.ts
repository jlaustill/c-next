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

  /**
   * Names the run-wide `SymbolTable.structFields` index has fields for.
   *
   * A SEPARATE table rather than a `kind` test on `symbols`, because that is what it
   * actually is. Deriving it from kinds is what broke the identity control at corpus
   * scale: I filtered on `{struct, typedef}` and `CopyConstructible` is a C++
   * `class`, so 262 observations reported a disagreement that was my kind filter
   * rather than the transpiler. Guessing which kinds "count as a struct" is exactly
   * the parallel-string-set reasoning #1285 spent seven PRs retiring; the index
   * membership is the fact, so the schema stores the fact.
   *
   * That C-Next struct fields live in `ICodeGenSymbols.structFields` while C/C++ ones
   * live here, in `SymbolTable.structFields`, is D4's substrate: two tables for one
   * relation, which is why the two sibling accessors could resolve them differently.
   */
  readonly structFieldOwners: readonly string[];

  /**
   * The run-wide `SymbolTable.structFields` index as (owner, field) pairs.
   *
   * C and C++ struct fields are registered here and have NO rows in `members`, which
   * is built from `TSymbol` variants -- so a query over `members` alone answers
   * `false` for `Rectangle.origin` while the live accessor answers `true`. Two tables
   * for one relation, C-Next fields in one and foreign fields in the other, is D4's
   * substrate stated as a schema fact.
   */
  readonly runWideStructFields: ReadonlyArray<{
    readonly owner: string;
    readonly field: string;
  }>;

  /**
   * Names the run-wide opaque-type index holds.
   *
   * The per-file `ICodeGenSymbols.opaqueTypes` is seeded from this at
   * `Transpiler.ts:632-640` -- but through `getAllOpaqueTypes().filter(isOpaqueType)`
   * and only when the result is non-empty, so the per-file set is a SUBSET of this
   * one rather than a copy. D5 is right that the per-file shape is run-wide-sourced;
   * "100% run-wide" overstates it by one filter.
   */
  readonly opaqueTypeNames: readonly string[];
}

export default IFactStore;
