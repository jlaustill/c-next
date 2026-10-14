import type IAnalysis from "../../cnx/TRANSPILE/1-Analyze/types/IAnalysis";
import type ITranspileError from "../../cnx/types/ITranspileError";

/**
 * What 1.2 Parse through 2.1 Analyze return to the host: plain data only (#1932, #1991).
 *
 * - `stopped`: 1.2 or 1.3 failed (`errors`), or 1.4 Resolve's checks ended
 *   the run (`errors` empty; the host recorded its own).
 * - `analyzed`: 2.1's artifact itself, which 2.2 Plan takes.
 */
type TFrontEndResult =
  | {
      readonly kind: "stopped";
      readonly errors: readonly ITranspileError[];
    }
  | {
      readonly kind: "analyzed";
      readonly analysis: IAnalysis;
    };

export default TFrontEndResult;
