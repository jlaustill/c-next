/**
 * Helper utilities for generating bit range access code.
 * Extracted from CodeGenerator to improve testability.
 */

/**
 * Options for generating float bit read expressions.
 */
interface IFloatBitReadOptions {
  shadowName: string;
  varName: string;
  start: string;
  mask: string;
  shadowIsCurrent: boolean;
}

/**
 * Options for generating integer bit read expressions.
 */
interface IIntegerBitReadOptions {
  varName: string;
  start: string;
  mask: string;
}

/**
 * Helper class for bit range access code generation.
 */
class BitRangeHelper {
  /**
   * Build the bit read expression for floats.
   * Uses memcpy pattern to safely reinterpret float bits.
   */
  static buildFloatBitReadExpr(options: IFloatBitReadOptions): string {
    const { shadowName, varName, start, mask, shadowIsCurrent } = options;

    const shiftedRead =
      start === "0"
        ? `(${shadowName} & ${mask})`
        : `((${shadowName} >> ${start}) & ${mask})`;

    if (shadowIsCurrent) {
      return shiftedRead;
    }

    // Need memcpy to update shadow
    const memcpyPrefix = `memcpy(&${shadowName}, &${varName}, sizeof(${varName}))`;
    return `(${memcpyPrefix}, ${shiftedRead})`;
  }

  /**
   * Generate integer bit range read: ((value >> start) & mask)
   * Optimizes away the shift when start is 0.
   */
  static buildIntegerBitReadExpr(options: IIntegerBitReadOptions): string {
    const { varName, start, mask } = options;

    if (start === "0") {
      return `((${varName}) & ${mask})`;
    }
    return `((${varName} >> ${start}) & ${mask})`;
  }

  /**
   * Generate the shadow variable name for float bit access.
   */
  static getShadowVarName(rawName: string): string {
    return `__bits_${rawName}`;
  }

  /**
   * Get the shadow type for a float type.
   */
  static getShadowType(baseType: string): string {
    return baseType === "f64" ? "uint64_t" : "uint32_t";
  }

  /**
   * Generate a shadow variable declaration.
   */
  static buildShadowDeclaration(
    shadowName: string,
    shadowType: string,
  ): string {
    return `${shadowType} ${shadowName};`;
  }
}

export default BitRangeHelper;
