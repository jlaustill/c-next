/**
 * Parameter information extracted from a C++ declarator.
 */
interface IExtractedParameter {
  name: string;
  type: string;
  isConst: boolean;
  isArray: boolean;
}

export default IExtractedParameter;
