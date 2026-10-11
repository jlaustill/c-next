/**
 * Dependencies needed for parameter dereference resolution
 */
interface IParameterDereferenceDeps {
  /** Check if a type is a float type (f32, f64) */
  isFloatType(typeName: string): boolean;

  /** Check if a type is a known primitive */
  isKnownPrimitive(typeName: string): boolean;

  /** Set of known enum names */
  knownEnums: ReadonlySet<string>;

  /** Check if a parameter is pass-by-value by name */
  isParameterPassByValue(functionName: string, paramName: string): boolean;

  /** Current function name (null if at global scope) */
  currentFunctionName: string | null;

  /** In C++ mode, primitives become references and don't need dereferencing */
  maybeDereference(id: string): string;
}

export default IParameterDereferenceDeps;
