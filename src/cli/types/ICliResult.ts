/**
 * Result from CLI argument parsing and configuration
 */
import ICliConfig from "./ICliConfig";

interface ICliResult {
  /** Whether to execute transpilation */
  shouldRun: boolean;
  /** Exit code (0 for success, 1 for error) */
  exitCode: number;
  /** Transpiler config (only present if shouldRun is true) */
  config?: ICliConfig;
  /** Whether to start JSON-RPC server mode */
  serveMode?: boolean;
}

export default ICliResult;
