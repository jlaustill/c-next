/**
 * Callbacks required for parameter type resolution.
 * Issue #793: Used by FunctionContextManager for CodeGenerator dependencies.
 */
interface IFunctionContextCallbacks {
  /** Check if a type name is a struct type */
  isStructType: (typeName: string) => boolean;
  /** Resolve qualified type identifiers to a type name */
  resolveQualifiedType: (identifiers: string[]) => string;
}

export default IFunctionContextCallbacks;
