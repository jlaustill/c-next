/**
 * FloatBitHelper - Generates float bit write operations using union-based type punning
 *
 * Issue #644: Extracted from CodeGenerator to reduce file size.
 * Issue #857: Changed from memcpy to union for MISRA C:2012 Rule 21.15 compliance.
 *
 * Floats don't support direct bit access in C, so we use a union for type punning.
 * The pattern:
 *   1. Declare union variable if needed: union { float f; uint32_t u; } __bits_name;
 *   2. Copy float to union: __bits_name.f = floatVar;
 *   3. Modify bits via union member: __bits_name.u = ...
 *   4. Copy back: floatVar = __bits_name.f;
 *
 * This approach is MISRA-compliant because union type punning is well-defined in C99+.
 *
 * Migrated to use CodeGenState instead of constructor DI.
 */

import TTypeInfo from "../../../../transpiler/types/TTypeInfo";
import TIncludeHeader from "../../../../transpiler/types/TIncludeHeader";
import BitRangeHelper from "./BitRangeHelper";
import BitUtils from "../../../../utils/BitUtils";
import type TranspileState from "../../../TranspileState";

/**
 * Callback types for code generation operations.
 */
interface IFloatBitCallbacks {
  /** Request an include header */
  requireInclude: (header: TIncludeHeader) => void;
}

/**
 * Get the C float type name for a C-Next float type.
 */
const getFloatTypeName = (baseType: string): string => {
  return baseType === "f64" ? "double" : "float";
};

/**
 * Generates float bit write operations using union-based type punning.
 *
 * For single bit: width is null, uses bitIndex only
 * For bit range: width is provided, uses bitIndex as start position
 */
class FloatBitHelper {
  /**
   * Generate float bit write using union-based type punning.
   * Returns null if typeInfo is not a float type.
   *
   * Uses union { float f; uint32_t u; } for MISRA 21.15 compliance instead of memcpy.
   *
   * @param name - Variable name being written
   * @param typeInfo - Type information for the variable
   * @param bitIndex - Bit index expression (start position)
   * @param width - Bit width expression (null for single bit)
   * @param value - Value to write
   * @param callbacks - Code generation callbacks
   * @returns Generated C code, or null if not a float type
   */
  static generateFloatBitWrite(
    name: string,
    typeInfo: TTypeInfo,
    bitIndex: string,
    width: string | null,
    value: string,
    callbacks: IFloatBitCallbacks,
    state: TranspileState,
  ): string | null {
    const isFloatType =
      typeInfo.baseType === "f32" || typeInfo.baseType === "f64";
    if (!isFloatType) {
      return null;
    }

    callbacks.requireInclude("float_static_assert"); // For size verification

    const isF64 = typeInfo.baseType === "f64";
    const floatType = getFloatTypeName(typeInfo.baseType);
    const intType = isF64 ? "uint64_t" : "uint32_t";
    const shadowName = BitRangeHelper.getShadowVarName(name);

    // Check if shadow variable needs declaration
    const needsDeclaration = !state.floatBitShadows.has(shadowName);
    if (needsDeclaration) {
      state.floatBitShadows.add(shadowName);
    }

    // Check if shadow already has current value (skip redundant read)
    const shadowIsCurrent = state.floatShadowCurrent.has(shadowName);

    // Union declaration: union { float f; uint32_t u; } __bits_name;
    const decl = needsDeclaration
      ? `union { ${floatType} f; ${intType} u; } ${shadowName};\n`
      : "";
    // Read from float into union: __bits_name.f = floatVar;
    const readUnion = shadowIsCurrent ? "" : `${shadowName}.f = ${name};\n`;

    // Mark shadow as current after this write
    state.floatShadowCurrent.add(shadowName);

    // The integer member is written like any other integer (#1668): a bit
    // or a bit range of a uint32_t or a uint64_t
    const bits = `${shadowName}.u`;
    const write =
      width === null
        ? BitUtils.singleBitWrite(bits, bitIndex, value, intType)
        : BitUtils.multiBitWrite(bits, bitIndex, width, value, intType);
    return `${decl}${readUnion}${write}\n${name} = ${shadowName}.f;`;
  }
}

export default FloatBitHelper;
