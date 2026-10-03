import ITranspileError from "../../lib/types/ITranspileError";
import IGrammarCoverageReport from "../../types/IGrammarCoverageReport";
import IFileResult from "../../types/IFileResult";
import type IRecordedRequirement from "../../types/IRecordedRequirement";
import type IRecordedAdrSite from "../../types/IRecordedAdrSite";

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

  /** Aggregate errors across all files */
  errors: ITranspileError[];

  /** Warnings (non-fatal issues) */
  warnings: string[];

  /** ADR-049: the run's one target, and where it came from */
  target?: { readonly name: string; readonly source: string };

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

  /**
   * Issue #1241: every position at which an ADR's rule fired while generating
   * this run's output. Consumed by the scope-context matrix so a fixture that
   * asserts generated C -- rather than a diagnostic -- can occupy a cell.
   */
  adrSites?: readonly IRecordedAdrSite[];
}

export default ITranspilerResult;
