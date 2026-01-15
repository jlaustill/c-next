import ITranspileError from "./ITranspileError";
import IGrammarCoverageReport from "../../analysis/types/IGrammarCoverageReport";

/**
 * Result of transpiling C-Next source to C
 */
interface ITranspileResult {
  /** Whether transpilation succeeded without errors */
  success: boolean;
  /** Generated C code (empty string if failed) */
  code: string;
  /** List of errors and warnings */
  errors: ITranspileError[];
  /** Number of top-level declarations found */
  declarationCount: number;
  /** Issue #35: Grammar coverage report (if collectGrammarCoverage was enabled) */
  grammarCoverage?: IGrammarCoverageReport;
}

export default ITranspileResult;
