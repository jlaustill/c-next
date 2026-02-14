/**
 * Information extracted from a C/C++ parameter declaration.
 */
interface IExtractedParameter {
  /** Parameter name (may be empty for abstract declarators) */
  readonly name: string;

  /** Parameter type as string */
  readonly type: string;

  /** Whether the parameter is const-qualified */
  readonly isConst: boolean;

  /** Whether the parameter is an array */
  readonly isArray: boolean;
}

export default IExtractedParameter;
