/**
 * Callbacks required for parameter type resolution.
 * Issue #793: Used by FunctionContextManager for CodeGenerator dependencies.
 *
 * #1445: `resolveQualifiedType` is gone. It was the C++-namespace half of the
 * `Scope.Type` decision, threaded here so the manager could run `TypeBinding`
 * itself; the planner runs that ladder now and the manager receives its
 * answer, so the callback had no reader left.
 */
interface IFunctionContextCallbacks {
  /** Check if a type name is a struct type */
  isStructType: (typeName: string) => boolean;
  /** Issue #958: Check if a type name is a typedef'd struct from C headers */
  isTypedefStructType?: (typeName: string) => boolean;
}

export default IFunctionContextCallbacks;
