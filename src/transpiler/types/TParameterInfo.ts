/**
 * Parameter information for function signatures
 *
 * Note: Pass-by-value status for small unmodified primitives (Issue #269)
 * is tracked separately in CodeGenerator.passByValueParams map rather than
 * here, since it requires call graph analysis that happens after parameter
 * collection.
 */
type TParameterInfo = {
  name: string;
  baseType: string; // 'u32', 'f32', 'Point'
  isArray: boolean;
  isStruct: boolean;
  isConst: boolean; // ADR-013
  isCallback: boolean; // ADR-029
  isString: boolean; // ADR-045
  /**
   * Issue #895: True when a primitive param becomes a pointer due to callback typedef.
   * When used as a value in expressions, these params need dereferencing (*param).
   */
  isCallbackPointerPrimitive?: boolean;

  /**
   * Issue #895: True when a param needs pointer semantics due to callback typedef.
   * In C++ mode, this forces -> member access instead of . (reference access).
   * Applies to both struct and primitive callback-compatible params.
   */
  forcePointerSemantics?: boolean;
};

export default TParameterInfo;
