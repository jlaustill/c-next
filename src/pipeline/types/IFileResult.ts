import ITranspileError from "../../lib/types/ITranspileError";
import ITranspileContribution from "./ITranspileContribution";

/**
 * Result of transpiling a single file
 */
interface IFileResult {
  /** Source file path */
  sourcePath: string;

  /** Generated C code (empty if failed) */
  code: string;

  /** Generated header code (empty if headers not requested or failed) */
  headerCode?: string;

  /** Output file path (if written to disk) */
  outputPath?: string;

  /** Whether transpilation succeeded */
  success: boolean;

  /** Errors for this file */
  errors: ITranspileError[];

  /** Number of top-level declarations found */
  declarationCount: number;

  /** Contributions from this file for accumulation in run() */
  contribution?: ITranspileContribution;
}

export default IFileResult;
