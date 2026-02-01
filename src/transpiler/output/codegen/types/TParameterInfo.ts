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
};

export default TParameterInfo;
