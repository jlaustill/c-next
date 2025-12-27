/**
 * Represents an error or warning from the transpiler
 */
export interface ITranspileError {
    /** Line number (1-based) */
    line: number;
    /** Column number (0-based) */
    column: number;
    /** Error message */
    message: string;
    /** Severity: 'error' or 'warning' */
    severity: 'error' | 'warning';
}

/**
 * Result of transpiling C-Next source to C
 */
export interface ITranspileResult {
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
