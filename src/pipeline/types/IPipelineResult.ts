import ITranspileError from "../../lib/types/ITranspileError";
import IGrammarCoverageReport from "../../analysis/types/IGrammarCoverageReport";
import IFileResult from "./IFileResult";

/**
 * Result of running the unified transpilation pipeline
 */
interface IPipelineResult {
  /** Overall success - true only if all files transpiled without errors */
  success: boolean;

  /** Per-file transpilation results */
  files: IFileResult[];

  /** Total files processed */
  filesProcessed: number;

  /** Total symbols collected from C/C++ headers */
  symbolsCollected: number;

  /** Symbol conflicts detected between files */
  conflicts: string[];

  /** Aggregate errors across all files */
  errors: ITranspileError[];

  /** Warnings (non-fatal issues) */
  warnings: string[];

  /** Output files generated */
  outputFiles: string[];

  /** Grammar coverage (if collectGrammarCoverage was enabled) */
  grammarCoverage?: IGrammarCoverageReport;
}

export default IPipelineResult;
