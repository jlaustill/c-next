/**
 * FloatBitHelper - Generates float bit write operations using shadow variables
 *
 * Issue #644: Extracted from CodeGenerator to reduce file size.
 *
 * Floats don't support direct bit access in C, so we use a shadow integer
 * variable and memcpy to read/write bit values. The pattern:
 *   1. Declare shadow variable if needed
 *   2. memcpy float → shadow (if not already current)
 *   3. Modify shadow bits
 *   4. memcpy shadow → float
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
 * Generates float bit write operations using shadow variables and memcpy.
 *
 * For single bit: width is null, uses bitIndex only
 * For bit range: width is provided, uses bitIndex as start position
 */
class FloatBitHelper {
  /**
   * Generate float bit write using shadow variable + memcpy.
   * Returns null if typeInfo is not a float type.
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

    callbacks.requireInclude("string"); // For memcpy
    callbacks.requireInclude("float_static_assert"); // For size verification

    const isF64 = typeInfo.baseType === "f64";
    const shadowType = isF64 ? "uint64_t" : "uint32_t";
    const shadowName = `__bits_${name}`;
    const maskSuffix = isF64 ? "ULL" : "U";

    // Check if shadow variable needs declaration
    const needsDeclaration = !CodeGenState.floatBitShadows.has(shadowName);
    if (needsDeclaration) {
      CodeGenState.floatBitShadows.add(shadowName);
    }

    // Check if shadow already has current value (skip redundant memcpy read)
    const shadowIsCurrent = CodeGenState.floatShadowCurrent.has(shadowName);

    const decl = needsDeclaration ? `${shadowType} ${shadowName}; ` : "";
    const readMemcpy = shadowIsCurrent
      ? ""
      : `memcpy(&${shadowName}, &${name}, sizeof(${name})); `;

    // Mark shadow as current after this write
    CodeGenState.floatShadowCurrent.add(shadowName);

    if (width === null) {
      // Single bit assignment: floatVar[3] <- true
      return (
        `${decl}${readMemcpy}` +
        `${shadowName} = (${shadowName} & ~(1${maskSuffix} << ${bitIndex})) | ((${shadowType})${callbacks.foldBooleanToInt(value)} << ${bitIndex}); ` +
        `memcpy(&${name}, &${shadowName}, sizeof(${name}));`
      );
    } else {
      // Bit range assignment: floatVar[0, 8] <- b0
      const mask = callbacks.generateBitMask(width, isF64);
      return (
        `${decl}${readMemcpy}` +
        `${shadowName} = (${shadowName} & ~(${mask} << ${bitIndex})) | (((${shadowType})${value} & ${mask}) << ${bitIndex}); ` +
        `memcpy(&${name}, &${shadowName}, sizeof(${name}));`
      );
    }
  }
}

export default FloatBitHelper;
