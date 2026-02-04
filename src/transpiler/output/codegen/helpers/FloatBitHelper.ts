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
 */

import TTypeInfo from "../types/TTypeInfo.js";
import TIncludeHeader from "../generators/TIncludeHeader.js";

/**
 * State tracking for float bit shadows.
 */
interface IFloatBitState {
  /** Shadow variables already declared in current scope */
  floatBitShadows: Set<string>;
  /** Shadows that currently hold the float's value (skip redundant memcpy read) */
  floatShadowCurrent: Set<string>;
}

/**
 * Dependencies required for float bit write generation.
 */
interface IFloatBitHelperDeps {
  /** Whether we're generating C++ code */
  cppMode: boolean;
  /** Float bit shadow tracking state */
  state: IFloatBitState;
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
  private readonly deps: IFloatBitHelperDeps;

  constructor(deps: IFloatBitHelperDeps) {
    this.deps = deps;
  }

  /**
   * Generate float bit write using shadow variable + memcpy.
   * Returns null if typeInfo is not a float type.
   *
   * @param name - Variable name being written
   * @param typeInfo - Type information for the variable
   * @param bitIndex - Bit index expression (start position)
   * @param width - Bit width expression (null for single bit)
   * @param value - Value to write
   * @returns Generated C code, or null if not a float type
   */
  generateFloatBitWrite(
    name: string,
    typeInfo: TTypeInfo,
    bitIndex: string,
    width: string | null,
    value: string,
  ): string | null {
    const isFloatType =
      typeInfo.baseType === "f32" || typeInfo.baseType === "f64";
    if (!isFloatType) {
      return null;
    }

    this.deps.requireInclude("string"); // For memcpy
    this.deps.requireInclude("float_static_assert"); // For size verification

    const isF64 = typeInfo.baseType === "f64";
    const shadowType = isF64 ? "uint64_t" : "uint32_t";
    const shadowName = `__bits_${name}`;
    const maskSuffix = isF64 ? "ULL" : "U";

    // Check if shadow variable needs declaration
    const needsDeclaration = !this.deps.state.floatBitShadows.has(shadowName);
    if (needsDeclaration) {
      this.deps.state.floatBitShadows.add(shadowName);
    }

    // Check if shadow already has current value (skip redundant memcpy read)
    const shadowIsCurrent = this.deps.state.floatShadowCurrent.has(shadowName);

    const decl = needsDeclaration ? `${shadowType} ${shadowName}; ` : "";
    const readMemcpy = shadowIsCurrent
      ? ""
      : `memcpy(&${shadowName}, &${name}, sizeof(${name})); `;

    // Mark shadow as current after this write
    this.deps.state.floatShadowCurrent.add(shadowName);

    if (width === null) {
      // Single bit assignment: floatVar[3] <- true
      return (
        `${decl}${readMemcpy}` +
        `${shadowName} = (${shadowName} & ~(1${maskSuffix} << ${bitIndex})) | ((${shadowType})${this.deps.foldBooleanToInt(value)} << ${bitIndex}); ` +
        `memcpy(&${name}, &${shadowName}, sizeof(${name}));`
      );
    } else {
      // Bit range assignment: floatVar[0, 8] <- b0
      const mask = this.deps.generateBitMask(width, isF64);
      return (
        `${decl}${readMemcpy}` +
        `${shadowName} = (${shadowName} & ~(${mask} << ${bitIndex})) | (((${shadowType})${value} & ${mask}) << ${bitIndex}); ` +
        `memcpy(&${name}, &${shadowName}, sizeof(${name}));`
      );
    }
  }
}

export default FloatBitHelper;
