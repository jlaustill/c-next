/**
 * HeaderEmissionPlanner
 *
 * #1323: the whole-program step that turns every file's captured
 * `IHeaderEmissionFacts` into rendered header text, run once after every file
 * has been transpiled.
 *
 * Deliberately thin: the hard part -- resolving `CodeGenState.needsISR`,
 * `generatedStructInits`, callback typedefs and ADR-006 auto-const -- already
 * happened per file, while that file's state was warm, and is frozen into the
 * `IHeaderEmissionFacts` this consumes (`Transpiler._captureHeaderEmissionFacts`).
 * This class touches no `CodeGenState` and holds no state of its own -- it
 * exists so the render call is genuinely centralized rather than interleaved
 * with the per-file transpile loop, which is the seam #1449's real 2.2 Plan
 * pass needs to build on.
 */
import HeaderGenerator from "./HeaderGenerator";
import IHeaderEmissionFacts from "../../types/IHeaderEmissionFacts";
import IEmissionPlan from "../../types/IEmissionPlan";

class HeaderEmissionPlanner {
  /**
   * Render every captured file's header. One file's render failure is
   * isolated to that file's entry in `errorsBySourcePath` -- it neither
   * aborts the batch nor is silently dropped, matching the per-file isolation
   * `Transpiler._transpileFile`'s own try/catch already gives `.c`/`.cpp`
   * generation (`Transpiler.buildCatchResult`).
   *
   * @param factsBySourcePath - captured facts per file that has a public
   *   header; a file with none (`PublicInterface.forFile` was empty) has no
   *   entry and gets no `headersBySourcePath` entry either.
   */
  static plan(
    factsBySourcePath: ReadonlyMap<string, IHeaderEmissionFacts>,
    headerGenerator: HeaderGenerator,
  ): IEmissionPlan {
    const headersBySourcePath = new Map<string, string>();
    const errorsBySourcePath = new Map<string, string>();

    for (const [sourcePath, facts] of factsBySourcePath) {
      try {
        const headerCode = headerGenerator.generate(
          [...facts.symbols],
          facts.filename,
          facts.options,
          facts.typeInput,
          facts.passByValueParams,
          facts.allKnownEnums,
          facts.basename,
        );
        headersBySourcePath.set(sourcePath, headerCode);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errorsBySourcePath.set(sourcePath, message);
      }
    }

    return { headersBySourcePath, errorsBySourcePath };
  }
}

export default HeaderEmissionPlanner;
