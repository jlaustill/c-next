/**
 * Error reported when a struct field has a reserved name
 * Struct fields cannot use names that conflict with C-Next built-in properties
 */
interface IStructFieldError {
  /** Error code (E0355) */
  code: string;
  /** Name of the struct */
  structName: string;
  /** Name of the problematic field */
  fieldName: string;
  /** Line number where the field is declared */
  line: number;
  /** Column number where the field is declared */
  column: number;
  /** Human-readable error message */
  message: string;
  /** Optional help text with suggested fix */
  helpText?: string;
}

export default IStructFieldError;
