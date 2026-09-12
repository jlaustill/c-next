import type IRecordedRequirement from "./IRecordedRequirement";
import ITranspileError from "../../lib/types/ITranspileError";

/**
 * Result of transpiling a single file
 */
interface IFileResult {
  /** Source file path */
  sourcePath: string;

  /**
   * Generated C code.
   *
   * Empty whenever this file was never planned, which is not the same as
   * `success` being `false`: parse-only mode, and #1320 (another file in the
   * same program was rejected by 2.1 Analyze, so nothing is planned for ANY
   * file -- including one 2.1 found clean) both report `success: true` here.
   * A non-empty string is the only sign real codegen ran for this file.
   */
  code: string;

  /**
   * Generated header code. Undefined for every reason `code` is empty (see
   * above), and also when this file's public interface has no header content
   * of its own to emit.
   */
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
