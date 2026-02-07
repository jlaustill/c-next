/**
 * CppMemberHelper
 *
 * Helper class for C++ member conversion logic.
 * Extracts testable pure functions from CodeGenerator for Issue #251/#252/#256.
 *
 * This handles cases where passing struct members to functions in C++ mode
 * requires temporary variables:
 * 1. Const struct parameter member -> non-const parameter
 * 2. External C struct members of bool/enum type -> u8 parameter
 * 3. Array element member access with external struct elements
 */

import TYPE_MAP from "../../../../utils/constants/TypeMappings.js";
import IPostfixOp from "./types/IPostfixOp";

/**
 * Parameter info from the type registry
 */
interface IParamInfo {
  baseType: string;
  isStruct?: boolean;
  isConst?: boolean;
}

/**
 * Type info from the type registry
 */
interface ITypeInfo {
  baseType: string;
  isArray?: boolean;
  isString?: boolean;
}

class CppMemberHelper {
  /**
   * Check if target type is u8 (could be bool or typed enum from C header)
   * Issue #252: External C structs may have bool/enum members that need casting
   */
  static isU8TargetType(targetParamBaseType: string): boolean {
    return TYPE_MAP[targetParamBaseType] === "uint8_t";
  }

  /**
   * Case 1: Direct parameter member access needs conversion?
   * Issue #251: Const struct parameter needs temp to break const chain
   * Issue #252: External C structs may have bool/enum members
   */
  static needsParamMemberConversion(
    paramInfo: IParamInfo,
    targetParamBaseType: string,
  ): boolean {
    const isPrimitiveParam = !!TYPE_MAP[paramInfo.baseType];
    const couldBeStruct = paramInfo.isStruct || !isPrimitiveParam;

    if (!couldBeStruct) return false;

    // Const struct parameter needs temp to break const chain
    if (paramInfo.isConst) return true;

    // External C structs may have bool/enum members that need casting
    return CppMemberHelper.isU8TargetType(targetParamBaseType);
  }

  /**
   * Check if array element member access needs conversion
   * Issue #256: arr[i].member patterns with external struct elements
   */
  static needsArrayElementMemberConversion(
    precedingOps: IPostfixOp[],
    typeInfo: ITypeInfo | undefined,
    targetParamBaseType: string,
  ): boolean {
    const hasArraySubscript = precedingOps.some((op) => op.hasExpression);
    if (!hasArraySubscript) return false;

    if (!typeInfo?.isArray) return false;

    const isPrimitiveElement = !!TYPE_MAP[typeInfo.baseType];
    if (isPrimitiveElement) return false;

    return CppMemberHelper.isU8TargetType(targetParamBaseType);
  }

  /**
   * Check if function return member access needs conversion
   * Issue #256: getConfig().member patterns
   */
  static needsFunctionReturnMemberConversion(
    precedingOps: IPostfixOp[],
    targetParamBaseType: string,
  ): boolean {
    const hasFunctionCall = precedingOps.some(
      (op) => op.hasArgumentList || op.textEndsWithParen,
    );
    if (!hasFunctionCall) return false;

    return CppMemberHelper.isU8TargetType(targetParamBaseType);
  }

  /**
   * Case 2: Array element or function return member access needs conversion?
   * Issue #256: arr[i].member or getConfig().member patterns
   */
  static needsComplexMemberConversion(
    ops: IPostfixOp[],
    typeInfo: ITypeInfo | undefined,
    targetParamBaseType: string,
  ): boolean {
    if (ops.length < 2) return false;

    const lastOp = ops.at(-1)!;
    // Last op must be member access (.identifier)
    if (!lastOp.hasIdentifier) return false;

    const precedingOps = ops.slice(0, -1);

    // Case 2a: Array element member access (arr[i].member)
    if (
      CppMemberHelper.needsArrayElementMemberConversion(
        precedingOps,
        typeInfo,
        targetParamBaseType,
      )
    ) {
      return true;
    }

    // Case 2b: Function return member access (getConfig().member)
    return CppMemberHelper.needsFunctionReturnMemberConversion(
      precedingOps,
      targetParamBaseType,
    );
  }

  /**
   * Check if a string subscript access pattern is present
   * Issue #246: buf[0] where buf is a string<N>
   */
  static isStringSubscriptPattern(
    hasPostfixOps: boolean,
    lastOpHasExpression: boolean,
    typeInfo: ITypeInfo | undefined,
    paramIsString: boolean,
  ): boolean {
    if (!hasPostfixOps) return false;
    if (!lastOpHasExpression) return false;

    if (typeInfo?.isString) return true;
    if (paramIsString) return true;

    return false;
  }

  /**
   * Determine last postfix operation type
   * Returns "function", "member", "array", or null
   */
  static getLastPostfixOpType(
    ops: IPostfixOp[],
  ): "function" | "member" | "array" | null {
    if (ops.length === 0) return null;

    const lastOp = ops.at(-1)!;

    // Function call: ()
    if (lastOp.hasArgumentList || lastOp.textEndsWithParen) {
      return "function";
    }

    // Member access: .identifier
    if (lastOp.hasIdentifier) {
      return "member";
    }

    // Array access: [expression]
    if (lastOp.hasExpression) {
      return "array";
    }

    return null;
  }
}

export default CppMemberHelper;
