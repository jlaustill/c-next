/**
 * Parameter information for function signatures
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
