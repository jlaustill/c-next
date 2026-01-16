import ITranspileError from "../../lib/types/ITranspileError";

/**
 * Result of transpiling a single file
 */
interface IFileResult {
  /** Source file path */
  sourcePath: string;

  /** Generated C code (empty if failed) */
  code: string;

  /** Output file path (if written to disk) */
  outputPath?: string;

  /** Whether transpilation succeeded */
  success: boolean;

  /** Errors for this file */
  errors: ITranspileError[];

  /** Number of top-level declarations found */
  declarationCount: number;
}

export default IFileResult;
