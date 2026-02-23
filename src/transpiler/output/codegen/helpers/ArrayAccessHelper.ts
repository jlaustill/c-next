/**
 * Helper utilities for generating array access code.
 * Extracted from CodeGenerator to improve testability.
 */
import IArrayAccessInfo from "../types/IArrayAccessInfo";
import IArrayAccessDeps from "../types/IArrayAccessDeps";
import BitRangeHelper from "./BitRangeHelper";
import CodeGenErrors from "./CodeGenErrors";

/**
 * Helper class for array access code generation.
 * Works with an intermediate representation (IArrayAccessInfo)
 * instead of ANTLR parser contexts for testability.
 */
class ArrayAccessHelper {
  /**
   * Generate the complete array access expression.
   * Routes to single-index or bit-range based on accessType.
   */
  static generate(info: IArrayAccessInfo, deps: IArrayAccessDeps): string {
    if (info.accessType === "single-index") {
      return ArrayAccessHelper.generateSingleIndex(info);
    }
    return ArrayAccessHelper.generateBitRange(info, deps);
  }

  /**
   * Generate single-index access: array[i]
   * Validates that bitmap types don't use bracket notation.
   */
  static generateSingleIndex(info: IArrayAccessInfo): string {
    ArrayAccessHelper.validateNotBitmap(info);
    return `${info.resolvedName}[${info.indexExpr}]`;
  }

  /**
   * Validate bitmap access is not using bracket notation.
   * Bitmaps must use named field access (e.g., flags.FIELD_NAME).
   * @throws Error if attempting bracket indexing on a bitmap type
   */
  static validateNotBitmap(info: IArrayAccessInfo): void {
    if (info.typeInfo?.isBitmap && info.typeInfo.bitmapTypeName) {
      throw CodeGenErrors.bitmapBracketIndexing(
        info.line,
        info.typeInfo.bitmapTypeName,
        info.rawName,
      );
    }
  }

  /**
   * Generate bit range access: value[start, width]
   * Handles both integer and float types.
   */
  static generateBitRange(
    info: IArrayAccessInfo,
    deps: IArrayAccessDeps,
  ): string {
    if (ArrayAccessHelper.isFloatBitRange(info.typeInfo)) {
      return ArrayAccessHelper.generateFloatBitRange(info, deps);
    }
    return ArrayAccessHelper.generateIntegerBitRange(info, deps);
  }

  /**
   * Determine if this is a float bit range (needs shadow variable).
   */
  static isFloatBitRange(typeInfo: { baseType?: string } | undefined): boolean {
    return typeInfo?.baseType === "f32" || typeInfo?.baseType === "f64";
  }

  /**
   * Generate float bit range read with union-based type punning.
   * Uses union { float f; uint32_t u; } for MISRA 21.15 compliance.
   *
   * NOTE: This helper is not used in production (PostfixExpressionGenerator
   * handles float bit access directly). It exists for testing and completeness.
   */
  static generateFloatBitRange(
    info: IArrayAccessInfo,
    deps: IArrayAccessDeps,
  ): string {
    if (!deps.isInFunctionBody()) {
      throw CodeGenErrors.floatBitIndexingAtGlobalScope(
        info.rawName,
        info.startExpr ?? "0",
        info.widthExpr ?? "0",
      );
    }

    // No string.h needed - uses union-based type punning
    deps.requireInclude("float_static_assert");

    const isF64 = info.typeInfo?.baseType === "f64";
    const shadowType = BitRangeHelper.getShadowType(
      info.typeInfo?.baseType ?? "f32",
    );
    const shadowName = BitRangeHelper.getShadowVarName(info.rawName);
    const mask = deps.generateBitMask(info.widthExpr ?? "0", isF64);

    // Register shadow variable if not already declared
    deps.registerFloatShadow(shadowName, shadowType);

    const shadowIsCurrent = deps.isShadowCurrent(shadowName);
    deps.markShadowCurrent(shadowName);

    return BitRangeHelper.buildFloatBitReadExpr({
      shadowName,
      varName: info.resolvedName,
      start: info.startExpr ?? "0",
      mask,
      shadowIsCurrent,
    });
  }

  /**
   * Generate integer bit range read: ((value >> start) & mask)
   * Passes sourceType and targetType to BitRangeHelper for MISRA 10.3 casts.
   */
  static generateIntegerBitRange(
    info: IArrayAccessInfo,
    deps: IArrayAccessDeps,
  ): string {
    const mask = deps.generateBitMask(info.widthExpr ?? "0");
    return BitRangeHelper.buildIntegerBitReadExpr({
      varName: info.resolvedName,
      start: info.startExpr ?? "0",
      mask,
      sourceType: info.typeInfo?.baseType,
      targetType: info.targetType,
    });
  }
}

export default ArrayAccessHelper;
