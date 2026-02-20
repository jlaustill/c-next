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

import TTypeInfo from "../types/TTypeInfo.js";
import TIncludeHeader from "../generators/TIncludeHeader.js";
import CodeGenState from "../../../state/CodeGenState.js";

/**
 * Callback types for code generation operations.
 */
interface IFloatBitCallbacks {
  /** Generate a bit mask expression */
  generateBitMask: (width: string, is64Bit?: boolean) => string;
  /** Fold boolean expressions to 0/1 integer */
  foldBooleanToInt: (expr: string) => string;
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
    const shadowName = `__bits_${name}`;
    const maskSuffix = isF64 ? "ULL" : "U";

    // Check if shadow variable needs declaration
    const needsDeclaration = !CodeGenState.floatBitShadows.has(shadowName);
    if (needsDeclaration) {
      CodeGenState.floatBitShadows.add(shadowName);
    }

    // Check if shadow already has current value (skip redundant read)
    const shadowIsCurrent = CodeGenState.floatShadowCurrent.has(shadowName);

    // Union declaration: union { float f; uint32_t u; } __bits_name;
    const decl = needsDeclaration
      ? `union { ${floatType} f; ${intType} u; } ${shadowName};\n`
      : "";
    // Read from float into union: __bits_name.f = floatVar;
    const readUnion = shadowIsCurrent ? "" : `${shadowName}.f = ${name};\n`;

    // Mark shadow as current after this write
    CodeGenState.floatShadowCurrent.add(shadowName);

    if (width === null) {
      // Single bit assignment: floatVar[3] <- true
      return (
        `${decl}${readUnion}` +
        `${shadowName}.u = (${shadowName}.u & ~(1${maskSuffix} << ${bitIndex})) | ((${intType})${callbacks.foldBooleanToInt(value)} << ${bitIndex});\n` +
        `${name} = ${shadowName}.f;`
      );
    } else {
      // Bit range assignment: floatVar[0, 8] <- b0
      const mask = callbacks.generateBitMask(width, isF64);
      return (
        `${decl}${readUnion}` +
        `${shadowName}.u = (${shadowName}.u & ~(${mask} << ${bitIndex})) | (((${intType})${value} & ${mask}) << ${bitIndex});\n` +
        `${name} = ${shadowName}.f;`
      );
    }
  }
}

export default FloatBitHelper;
