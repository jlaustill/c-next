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
  isParameter?: boolean; // Issue #579: Track if this is a function parameter (becomes pointer in C)
  isPointer?: boolean; // Issue #895 Bug B: Track if variable is a pointer (inferred from C function return type)
};

export default TTypeInfo;
