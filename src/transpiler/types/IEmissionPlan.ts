/**
 * The decided header content for every file in this run, keyed by source
 * path -- produced by `HeaderEmissionPlanner` from the `IHeaderEmissionFacts`
 * every file captured while its `CodeGenState` was warm.
 *
 * NOT #1449's whole-program `EmissionPlan` (2.2 Plan's deliverable). This is
 * narrower and interim, scoped to the one decision #1323 moves -- header
 * content. #1449 is free to absorb or reshape this once a real 2.2 Plan pass
 * exists; until then `Transpiler` is the interim owner, the same shape #1319
 * used for the same reason (commit d5b93635: "`Program` and `EmissionPlan`
 * do not exist in `src/`... `Transpiler` is the interim owner under the
 * bounded duplicate-path exception #1313 grants").
 */
interface IEmissionPlan {
  /** Source path -> rendered header text. A file with no public header has no entry. */
  readonly headersBySourcePath: ReadonlyMap<string, string>;

  /**
   * Source path -> the message from an exception `HeaderGenerator.generate()`
   * raised while rendering that file's header. Kept separate from a thrown
   * exception so one file's render failure cannot abort another's -- the same
   * per-file isolation `Transpiler._transpileFile`'s own try/catch already
   * gives `.c`/`.cpp` generation.
   */
  readonly errorsBySourcePath: ReadonlyMap<string, string>;
}

export default IEmissionPlan;
