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
    typeRegistry: Map<string, TTypeInfo>,
    symbols: ITypeSymbols,
    options: ITypeRegistrationOptions,
  ): boolean {
    if (!symbols.knownEnums.has(options.baseType)) {
      return false;
    }

    typeRegistry.set(options.name, {
      baseType: options.baseType,
      bitWidth: 0,
      isArray: false,
      isConst: options.isConst,
      isEnum: true,
      enumTypeName: options.baseType,
      overflowBehavior: options.overflowBehavior,
      isAtomic: options.isAtomic,
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
    options: ITypeRegistrationOptions,
    arrayDimensions: number[] | undefined,
  ): boolean {
    if (!symbols.knownBitmaps.has(options.baseType)) {
      return false;
    }

    const bitWidth = symbols.bitmapBitWidth.get(options.baseType) || 0;

    if (arrayDimensions && arrayDimensions.length > 0) {
      // Bitmap array
      typeRegistry.set(options.name, {
        baseType: options.baseType,
        bitWidth,
        isArray: true,
        arrayDimensions,
        isConst: options.isConst,
        isBitmap: true,
        bitmapTypeName: options.baseType,
        overflowBehavior: options.overflowBehavior,
        isAtomic: options.isAtomic,
      });
    } else {
      // Non-array bitmap
      typeRegistry.set(options.name, {
        baseType: options.baseType,
        bitWidth,
        isArray: false,
        isConst: options.isConst,
        isBitmap: true,
        bitmapTypeName: options.baseType,
        overflowBehavior: options.overflowBehavior,
        isAtomic: options.isAtomic,
      });
    }

    return true;
  }
}

export default TypeRegistrationUtils;
