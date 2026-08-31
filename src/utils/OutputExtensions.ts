import IOutputExtensions from "../transpiler/types/IOutputExtensions";

/**
 * Issue #1319: The single owner of "which extension does this run emit?".
 *
 * Before this existed the mapping was written out at nine sites in `data/`,
 * `logic/`, `output/` and the orchestrator. They agreed only because each had
 * been written the same way by hand; nothing made them agree, and five of them
 * defaulted the mode to `false`, so a site that was simply never passed the
 * value emitted `.h` in a C++ run without any diagnostic.
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
   * Map the settled C++ latch to the extensions the run emits.
   *
   * @param cppMode - The run's settled mode. Callers pass the latch itself, not
   *   a re-derived copy; there is no default, because a caller that does not
   *   know the mode cannot pick a correct extension and must not guess one.
   */
  static forCppMode(cppMode: boolean): IOutputExtensions {
    return cppMode ? CPP_EXTENSIONS : C_EXTENSIONS;
  }
}

export default OutputExtensions;
