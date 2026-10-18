/**
 * Dependencies needed for parameter dereference resolution
 */
interface IParameterDereferenceDeps {
  /** In C++ mode, primitives become references and don't need dereferencing */
  maybeDereference(id: string): string;
}

export default IParameterDereferenceDeps;
