import IOutputExtensions from "../transpiler/types/IOutputExtensions";

/**
 * Issue #1319: The single owner of "which extension does this run emit?".
 *
 * Before this existed the mapping was written out at nine sites in `data/`,
 * `logic/`, `output/` and the orchestrator. They agreed only because each had
 * been written the same way by hand; nothing made them agree, and six of them
 * defaulted the mode to `false`, so a site that was simply never passed the
 * value emitted `.h` in a C++ run without any diagnostic.
 *
 * Five of those six are gone. The sixth is `options?.cppMode ?? false` in
 * CodeGenerator, which reaches an extension through `CodeGenState.cppMode`;
 * making it required is 621 mechanical test edits, so it is tracked as #1428
 * rather than folded in here. `OutputExtensions.test.ts` pins it, so a seventh
 * cannot appear quietly.
 *
 * Consumers take the extension string they need. Only the run's owner asks this
 * class, so changing how a mode maps to an extension is one edit.
 */

/** Issue #933: C++ headers use .hpp so C and C++ output cannot overwrite each other. */
const CPP_EXTENSIONS: IOutputExtensions = Object.freeze({
  source: ".cpp",
  header: ".hpp",
});

const C_EXTENSIONS: IOutputExtensions = Object.freeze({
  source: ".c",
  header: ".h",
});

class OutputExtensions {
  /**
   * Map the run's declared mode to the extensions it emits.
   *
   * @param cppMode - The run's declared mode. There is no default: a caller
   *   that does not know the mode cannot pick a correct extension, and must not
   *   guess one. Guessing is precisely what #1319 removed.
   */
  static forCppMode(cppMode: boolean): IOutputExtensions {
    return cppMode ? CPP_EXTENSIONS : C_EXTENSIONS;
  }
}

export default OutputExtensions;
