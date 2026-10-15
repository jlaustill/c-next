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

  /** #2062: a C++ `T&`, which the callee may write through unless const */
  readonly isReference?: boolean;
}

export default IExtractedParameter;
