import type IAnalyzedFile from "../../../types/IAnalyzedFile";
import type IDiagnostics from "../../../types/IDiagnostics";
import type ITranspileError from "../../../types/ITranspileError";

/**
 * What `TreePasses.run` returns: plain data only (#1932).
 *
 * - `stopped`: 1.2 or 1.3 failed (`errors`), or the host's `resolve` ended
 *   the run (`errors` empty; the host recorded its own).
 * - `analyzed`: 2.1's verdict and, per file that produces output, the
 *   plain data 2.2 Plan and 2.3 Render read.
 */
type TTreePassesResult =
  | {
      readonly kind: "stopped";
      readonly errors: readonly ITranspileError[];
    }
  | {
      readonly kind: "analyzed";
      readonly diagnostics: IDiagnostics;
      readonly files: ReadonlyMap<string, IAnalyzedFile>;
    };

export default TTreePassesResult;
