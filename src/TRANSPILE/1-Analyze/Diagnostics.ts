import type ITranspileError from "../../lib/types/ITranspileError";
import type IDiagnostics from "../../transpiler/types/IDiagnostics";

/** Shared empty result, so a clean file does not allocate. */
const NONE: readonly ITranspileError[] = Object.freeze([]);

/**
 * Builds 2.1 Analyze's artifact.
 *
 * Mirrors `Program.build` (1.4): a static builder returning a frozen query
 * surface, with the raw table reachable only through it. The map is captured,
 * not exposed -- a consumer that could reach the table could also write to it,
 * and then "every diagnostic 2.1 authored" would stop being true of the
 * artifact that says so.
 */
class Diagnostics {
  /**
   * @param byFile one entry per analyzed file, in walk order, clean files
   *   included with an empty array
   */
  static build(
    byFile: ReadonlyMap<string, readonly ITranspileError[]>,
  ): IDiagnostics {
    // Snapshotted at build time rather than recomputed per call: the artifact
    // is immutable, so the answer is constant.
    const rejected = [...byFile.values()].some(
      (errors: readonly ITranspileError[]): boolean => errors.length > 0,
    );

    return Object.freeze({
      hasErrors: (): boolean => rejected,
      forFile: (sourcePath: string): readonly ITranspileError[] =>
        byFile.get(sourcePath) ?? NONE,
    });
  }
}

export default Diagnostics;
