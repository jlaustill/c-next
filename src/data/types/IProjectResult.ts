/**
 * Result of compiling a project
 */
interface IProjectResult {
  /** Whether compilation succeeded */
  success: boolean;

  /** Number of files processed */
  filesProcessed: number;

  /** Number of symbols collected */
  symbolsCollected: number;

  /** Symbol conflicts detected */
  conflicts: string[];

  /** Errors encountered */
  errors: string[];

  /** Warnings */
  warnings: string[];

  /** Generated output files */
  outputFiles: string[];
}

export default IProjectResult;
