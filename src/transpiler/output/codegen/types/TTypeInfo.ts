/**
 * Type information for variables and expressions
 */
import TOverflowBehavior from "./TOverflowBehavior";

type TTypeInfo = {
  baseType: string;
  bitWidth: number;
  isArray: boolean;
  arrayDimensions?: number[];
  isConst: boolean;
  isEnum?: boolean;
  enumTypeName?: string;
  isBitmap?: boolean;
  bitmapTypeName?: string;
  overflowBehavior?: TOverflowBehavior;
  isString?: boolean;
  stringCapacity?: number;
  isAtomic?: boolean;
  isExternalCppType?: boolean; // Issue #375: C++ types instantiated via constructor
};

export default TTypeInfo;
