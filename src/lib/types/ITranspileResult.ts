import ITranspileError from "./ITranspileError";

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
}

export default ITranspileResult;
