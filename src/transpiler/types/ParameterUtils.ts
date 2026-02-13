/**
 * Factory functions and type guards for IParameterInfo.
 *
 * Provides utilities for creating and inspecting C-Next function parameters.
 */
import type IParameterInfo from "./IParameterInfo";
import type TType from "./TType";

class ParameterUtils {
  // ============================================================================
  // Factory Functions
  // ============================================================================

  /**
   * Create a parameter with the given properties.
   *
   * @param name - Parameter name
   * @param type - Parameter type (TType discriminated union)
   * @param isConst - Whether the parameter is const-qualified
   * @param arrayDimensions - Array dimensions (optional)
   */
  static create(
    name: string,
    type: TType,
    isConst: boolean,
    arrayDimensions?: ReadonlyArray<number | string>,
  ): IParameterInfo {
    if (arrayDimensions !== undefined) {
      return { name, type, isConst, arrayDimensions };
    }
    return { name, type, isConst };
  }

  // ============================================================================
  // Type Guards
  // ============================================================================

  /**
   * Check if parameter has array dimensions.
   *
   * Returns true if arrayDimensions is defined and has at least one dimension.
   */
  static isArray(param: IParameterInfo): boolean {
    return (
      param.arrayDimensions !== undefined && param.arrayDimensions.length > 0
    );
  }
}

export default ParameterUtils;
