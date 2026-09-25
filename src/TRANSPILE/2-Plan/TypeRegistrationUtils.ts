/**
 * TypeRegistrationUtils
 * Extracted helpers for enum/bitmap type registration in CodeGenerator.
 *
 * This reduces duplication across the 4 type contexts (scopedType, globalType,
 * qualifiedType, userType) that each had identical enum/bitmap handling.
 */

import TOverflowBehavior from "../../transpiler/types/TOverflowBehavior";
import type IDeclaredTypeSets from "../../transpiler/types/IDeclaredTypeSets";
import DeclaredTypeFacts from "../../utils/DeclaredTypeFacts";
import type RenderState from "../3-Render/RenderState";

/**
 * Common options for type registration.
 * Groups parameters shared by enum and bitmap registration.
 */
interface ITypeRegistrationOptions {
  name: string;
  baseType: string;
  isConst: boolean;
  overflowBehavior: TOverflowBehavior;
  isAtomic: boolean;
}

/**
 * Utilities for registering enum and bitmap types in the type registry.
 */
class TypeRegistrationUtils {
  /**
   * Try to register a type as an enum.
   * Returns true if the type was a known enum and was registered.
   */
  static tryRegisterEnumType(
    symbols: IDeclaredTypeSets,
    options: ITypeRegistrationOptions,
    state: RenderState,
  ): boolean {
    if (!symbols.knownEnums.has(options.baseType)) {
      return false;
    }

    state.setVariableTypeInfo(options.name, {
      baseType: options.baseType,
      isArray: false,
      isConst: options.isConst,
      overflowBehavior: options.overflowBehavior,
      isAtomic: options.isAtomic,
      // An enum registers width 0 and is widened to ADR-017's 32 bits where it
      // is used, which is why the fallback here is 0 rather than a lookup.
      ...DeclaredTypeFacts.of(options.baseType, symbols, 0),
    });

    return true;
  }

  /**
   * Try to register a type as a bitmap.
   * Returns true if the type was a known bitmap and was registered.
   *
   * Handles both array and non-array bitmap types.
   */
  static tryRegisterBitmapType(
    symbols: IDeclaredTypeSets,
    options: ITypeRegistrationOptions,
    arrayDimensions: number[] | undefined,
    state: RenderState,
  ): boolean {
    if (!symbols.knownBitmaps.has(options.baseType)) {
      return false;
    }

    // The two branches this replaces differed in `isArray` and nothing else,
    // and each spelled the bitmap quintuple out again -- two more places to
    // miss a field, inside the one function that had it right.
    const isArray = arrayDimensions !== undefined && arrayDimensions.length > 0;

    state.setVariableTypeInfo(options.name, {
      baseType: options.baseType,
      isArray,
      ...(isArray && { arrayDimensions }),
      isConst: options.isConst,
      overflowBehavior: options.overflowBehavior,
      isAtomic: options.isAtomic,
      ...DeclaredTypeFacts.of(options.baseType, symbols, 0),
    });

    return true;
  }
}

export default TypeRegistrationUtils;
