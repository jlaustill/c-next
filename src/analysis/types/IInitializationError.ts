/**
 * Initialization analysis error types
 * Used for Rust-style "use before initialization" detection
 */

/**
 * Information about where a variable was declared
 */
export interface IDeclarationInfo {
  /** Variable name */
  name: string;
  /** Line where variable was declared */
  line: number;
  /** Column where variable was declared */
  column: number;
}

/**
 * Error for using a variable before initialization
 */
export interface IInitializationError {
  /** Error code (E0381 matches Rust's error code) */
  code: "E0381";
  /** The variable or field that was used before initialization */
  variable: string;
  /** Line where the uninitialized use occurred */
  line: number;
  /** Column where the uninitialized use occurred */
  column: number;
  /** Declaration info for the variable */
  declaration: IDeclarationInfo;
  /** Whether this is a "may be uninitialized" (conditional) or "definitely uninitialized" */
  mayBeUninitialized: boolean;
  /** Human-readable message */
  message: string;
}

/**
 * Format an initialization error into a Rust-style error message
 */
export function formatInitializationError(error: IInitializationError): string {
  const certainty = error.mayBeUninitialized ? "possibly " : "";
  return `error[${error.code}]: use of ${certainty}uninitialized variable '${error.variable}'
  --> line ${error.line}:${error.column}
   |
${error.declaration.line} |     ${error.declaration.name}
   |         - variable declared here
...
${error.line} |     ${error.variable}
   |     ^ use of ${certainty}uninitialized '${error.variable}'
   |
   = help: consider initializing '${error.variable}'`;
}

export default IInitializationError;
