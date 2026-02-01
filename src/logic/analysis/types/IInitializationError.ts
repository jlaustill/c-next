/**
 * Initialization analysis error types
 * Used for Rust-style "use before initialization" detection
 */
import IBaseAnalysisError from "./IBaseAnalysisError";
import IDeclarationInfo from "./IDeclarationInfo";

/**
 * Error for using a variable before initialization
 */
interface IInitializationError extends IBaseAnalysisError {
  /** The variable or field that was used before initialization */
  variable: string;
  /** Declaration info for the variable */
  declaration: IDeclarationInfo;
  /** Whether this is a "may be uninitialized" (conditional) or "definitely uninitialized" */
  mayBeUninitialized: boolean;
}

export default IInitializationError;
