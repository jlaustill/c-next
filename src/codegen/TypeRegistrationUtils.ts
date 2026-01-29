/**
 * TypeRegistrationUtils
 * Extracted helpers for enum/bitmap type registration in CodeGenerator.
 *
 * This reduces duplication across the 4 type contexts (scopedType, globalType,
 * qualifiedType, userType) that each had identical enum/bitmap handling.
 */

import TTypeInfo from "./types/TTypeInfo";
import TOverflowBehavior from "./types/TOverflowBehavior";

/**
 * Minimal symbol info interface for type registration.
 * Subset of ISymbolInfo used by registration helpers.
 */
interface ITypeSymbols {
  knownEnums: ReadonlySet<string>;
  knownBitmaps: ReadonlySet<string>;
  bitmapBitWidth: ReadonlyMap<string, number>;
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
    typeRegistry: Map<string, TTypeInfo>,
    symbols: ITypeSymbols,
    name: string,
    baseType: string,
    isConst: boolean,
    overflowBehavior: TOverflowBehavior,
    isAtomic: boolean,
  ): boolean {
    if (!symbols.knownEnums.has(baseType)) {
      return false;
    }

    typeRegistry.set(name, {
      baseType,
      bitWidth: 0,
      isArray: false,
      isConst,
      isEnum: true,
      enumTypeName: baseType,
      overflowBehavior,
      isAtomic,
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
    typeRegistry: Map<string, TTypeInfo>,
    symbols: ITypeSymbols,
    name: string,
    baseType: string,
    isConst: boolean,
    arrayDimensions: number[] | undefined,
    overflowBehavior: TOverflowBehavior,
    isAtomic: boolean,
  ): boolean {
    if (!symbols.knownBitmaps.has(baseType)) {
      return false;
    }

    const bitWidth = symbols.bitmapBitWidth.get(baseType) || 0;

    if (arrayDimensions && arrayDimensions.length > 0) {
      // Bitmap array
      typeRegistry.set(name, {
        baseType,
        bitWidth,
        isArray: true,
        arrayDimensions,
        isConst,
        isBitmap: true,
        bitmapTypeName: baseType,
        overflowBehavior,
        isAtomic,
      });
    } else {
      // Non-array bitmap
      typeRegistry.set(name, {
        baseType,
        bitWidth,
        isArray: false,
        isConst,
        isBitmap: true,
        bitmapTypeName: baseType,
        overflowBehavior,
        isAtomic,
      });
    }

    return true;
  }
}

export default TypeRegistrationUtils;
