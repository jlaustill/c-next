import type IRecordedRequirement from "./IRecordedRequirement";
import ITranspileError from "../../lib/types/ITranspileError";

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

  /**
   * Issue #1143: Toolchain requirements this file's generated output actually
   * carries, recorded by the emitters that produced the text.
   */
  requirements?: readonly IRecordedRequirement[];
}

export default IFileResult;
