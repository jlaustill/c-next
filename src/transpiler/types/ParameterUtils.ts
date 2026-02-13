/**
 * Factory functions and type guards for IParameterInfo.
 *
 * Provides utilities for creating and inspecting C-Next function parameters.
 */
import type IParameterInfo from "./symbols/IParameterInfo";
import type TType from "./TType";

class ParameterUtils {
  // ============================================================================
  // Factory Functions
  // ============================================================================

  /**
   * Create a parameter with the given properties.
   */
  static create(options: {
    name: string;
    type: TType;
    isConst: boolean;
    isArray: boolean;
    arrayDimensions?: ReadonlyArray<number | string>;
    isAutoConst?: boolean;
  }): IParameterInfo {
    return {
      name: options.name,
      type: options.type,
      isConst: options.isConst,
      isArray: options.isArray,
      ...(options.arrayDimensions !== undefined && {
        arrayDimensions: options.arrayDimensions,
      }),
      ...(options.isAutoConst !== undefined && {
        isAutoConst: options.isAutoConst,
      }),
    };
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
