import ITranspileError from "../../lib/types/ITranspileError";
import IGrammarCoverageReport from "../logic/analysis/types/IGrammarCoverageReport";
import IFileResult from "./IFileResult";
import type IRecordedRequirement from "./IRecordedRequirement";

/**
 * Result of running the unified transpiler
 */
interface ITranspilerResult {
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

  /**
   * Issue #1143: Union of every file's toolchain requirements, with the source
   * sites that incurred each. Printed by ResultPrinter and used to answer
   * "what does *my* project need?" rather than "what might C-Next need?".
   */
  requirements?: readonly IRecordedRequirement[];
}

export default ITranspilerResult;
