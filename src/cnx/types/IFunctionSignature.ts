/**
 * Function signature for const parameter tracking
 * Used to validate const-to-non-const errors at call sites
 */

interface IFunctionSignature {
  name: string;
  parameters: Array<{
    name: string;
    baseType: string; // The cnx type (e.g., 'u32', 'f32')
    isConst: boolean;
    isArray: boolean;
  }>;
}

export default IFunctionSignature;
