import type IAnalyzedFile from "../../cnx/types/IAnalyzedFile";
import type IDiagnostics from "../../cnx/types/IDiagnostics";
import type ITranspileError from "../../cnx/types/ITranspileError";

/**
 * What 1.2 Parse through 2.1 Analyze return to the host: plain data only (#1932, #1991).
 *
 * - `stopped`: 1.2 or 1.3 failed (`errors`), or 1.4 Resolve's checks ended
 *   the run (`errors` empty; the host recorded its own).
 * - `analyzed`: 2.1's verdict and, per file that produces output, the
 *   plain data 2.2 Plan and 2.3 Render read.
 */
type TFrontEndResult =
  | {
      readonly kind: "stopped";
      readonly errors: readonly ITranspileError[];
    }
  | {
      readonly kind: "analyzed";
      readonly diagnostics: IDiagnostics;
      readonly files: ReadonlyMap<string, IAnalyzedFile>;
    };

export default TFrontEndResult;
