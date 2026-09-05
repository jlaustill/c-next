/**
 * The rendered header text for every file in this run, keyed by source path.
 *
 * Produced by `HeaderEmissionPlanner` from the `IHeaderEmissionFacts` each file
 * captured while its `CodeGenState` was warm (#1323).
 *
 * ## It used to be called `IEmissionPlan`, and it is not one
 *
 * #1323 introduced it under that name as an interim owner, saying so in its own
 * doc: "NOT #1449's whole-program `EmissionPlan` (2.2 Plan's deliverable) ...
 * #1449 is free to absorb or reshape this once a real 2.2 Plan pass exists."
 * That pass now exists, so the name went to it and this type took one that says
 * what it holds. It is a RENDER result -- text, already produced -- and a plan
 * is what is decided BEFORE any text exists. Keeping the plan's name on
 * rendered output would have put the two passes' artifacts under one word,
 * which is the confusion the pass table exists to prevent.
 */
interface IHeaderRenderResult {
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

export default IHeaderRenderResult;
