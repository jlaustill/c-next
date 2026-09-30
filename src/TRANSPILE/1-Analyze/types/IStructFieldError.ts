/**
 * Error reported when a struct field has a reserved name
 * Struct fields cannot use names that conflict with C-Next built-in properties
 */
import IBaseAnalysisError from "./IBaseAnalysisError";

interface IStructFieldError extends IBaseAnalysisError {
  /** Name of the struct */
  structName: string;
  /** Name of the problematic field */
  fieldName: string;
}

export default IStructFieldError;
