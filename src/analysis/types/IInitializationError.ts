/**
 * Initialization analysis error types
 * Used for Rust-style "use before initialization" detection
 */

import IDeclarationInfo from "./IDeclarationInfo";

/**
 * Error for using a variable before initialization
 */
interface IInitializationError {
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

export default IInitializationError;
