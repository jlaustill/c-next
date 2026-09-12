import type ITranspileError from "../../lib/types/ITranspileError";

/**
 * 2.1 Analyze's artifact: every rejection C-Next makes about a whole program.
 *
 * `docs/architecture/README.md` §1 -- "**2.1 authors every rejection that
 * survives to it.** A diagnostic carries a code and a position, which means it
 * cannot originate from a `throw` in a later pass."
 *
 * ## Whole-program, which is the point
 *
 * Analysis used to be a step inside the per-file emission loop, so file N was
 * analyzed after files 1..N-1 had already been emitted (#1320). Nothing made
 * that order dependence visible, and #1430 is what it cost: `E0427` fired or
 * not depending on which order an entry listed its two `#include` lines,
 * because an analyzer read a map codegen fills.
 *
 * This artifact exists so that there is a moment at which every file's
 * diagnostics are known and no file has been planned. Holding one is the
 * evidence that the question "is this program legal?" has already been
 * answered for every file, not just the ones walked so far.
 */
interface IDiagnostics {
  /** Whether any file was rejected. */
  hasErrors(): boolean;

  /** This file's diagnostics, empty when 2.1 found nothing wrong with it. */
  forFile(sourcePath: string): readonly ITranspileError[];
}

export default IDiagnostics;
