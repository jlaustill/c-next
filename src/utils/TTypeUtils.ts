/**
 * Factory functions and type guards for TType.
 *
 * Provides utilities for creating and inspecting C-Next types.
 */
import type TType from "../types/TType";
import type TPrimitiveKind from "../types/TPrimitiveKind";

// Extract variant types from the discriminated union
type TPrimitiveType = Extract<TType, { kind: "primitive" }>;
type TStructType = Extract<TType, { kind: "struct" }>;
type TEnumType = Extract<TType, { kind: "enum" }>;
type TBitmapType = Extract<TType, { kind: "bitmap" }>;
type TArrayType = Extract<TType, { kind: "array" }>;
type TStringType = Extract<TType, { kind: "string" }>;
type TCallbackType = Extract<TType, { kind: "callback" }>;
type TRegisterType = Extract<TType, { kind: "register" }>;
type TExternalType = Extract<TType, { kind: "external" }>;
type TDeferredType = Extract<TType, { kind: "deferred" }>;

class TTypeUtils {
  // ============================================================================
  // Factory Functions
  // ============================================================================

  /**
   * Create a primitive type
   */
  static createPrimitive(primitive: TPrimitiveKind): TPrimitiveType {
    return { kind: "primitive", primitive };
  }

  /**
   * Create a struct type reference
   */
  static createStruct(name: string): TStructType {
    return { kind: "struct", name };
  }

  /**
   * Create an enum type reference
   */
  static createEnum(name: string): TEnumType {
    return { kind: "enum", name };
  }

  /**
   * Create a bitmap type reference
   * @public member of the TType factory set; tests build types with it
   */
  static createBitmap(name: string, bitWidth: number): TBitmapType {
    return { kind: "bitmap", name, bitWidth };
  }

  /**
   * Create an array type
   */
  static createArray(
    elementType: TType,
    dimensions: ReadonlyArray<number | string>,
  ): TArrayType {
    return { kind: "array", elementType, dimensions };
  }

  /**
   * Create a string type with capacity
   */
  static createString(capacity: number): TStringType {
    return { kind: "string", capacity };
  }

  /**
   * Create a callback type reference
   * @public member of the TType factory set; tests build types with it
   */
  static createCallback(name: string): TCallbackType {
    return { kind: "callback", name };
  }

  /**
   * Create a register type reference
   * @public member of the TType factory set; tests build types with it
   */
  static createRegister(name: string): TRegisterType {
    return { kind: "register", name };
  }

  /**
   * Create an external type (C++ templates, etc.)
   */
  /**
   * Create a type 1.3 Declare could not settle -- a bare name whose ADR-057
   * resolution needs the scope types this file's include closure declares, not
   * just this file's. 1.4 Resolve replaces it; nothing downstream may hold one.
   */
  static createDeferred(name: string, scopePath: string): TDeferredType {
    return { kind: "deferred", name, scopePath };
  }

  static createExternal(name: string): TExternalType {
    return { kind: "external", name };
  }

  // ============================================================================
  // Type Guards
  // ============================================================================

  /**
   * Check if type is a primitive
   */
  static isPrimitive(t: TType): t is TPrimitiveType {
    return t.kind === "primitive";
  }

  /**
   * Check if type is a struct
   * @public member of the TType guard set; tests narrow types with it
   */
  static isStruct(t: TType): t is TStructType {
    return t.kind === "struct";
  }

  /**
   * Check if type is an enum
   * @public member of the TType guard set; tests narrow types with it
   */
  static isEnum(t: TType): t is TEnumType {
    return t.kind === "enum";
  }

  /**
   * Check if type is a bitmap
   * @public member of the TType guard set; tests narrow types with it
   */
  static isBitmap(t: TType): t is TBitmapType {
    return t.kind === "bitmap";
  }

  /**
   * Check if type is an array
   * @public member of the TType guard set; tests narrow types with it
   */
  static isArray(t: TType): t is TArrayType {
    return t.kind === "array";
  }

  /**
   * Check if type is a string
   * @public member of the TType guard set; tests narrow types with it
   */
  static isString(t: TType): t is TStringType {
    return t.kind === "string";
  }

  /**
   * Check if type is a callback
   * @public member of the TType guard set; tests narrow types with it
   */
  static isCallback(t: TType): t is TCallbackType {
    return t.kind === "callback";
  }

  /**
   * Check if type is a register
   * @public member of the TType guard set; tests narrow types with it
   */
  static isRegister(t: TType): t is TRegisterType {
    return t.kind === "register";
  }

  /** @public member of the TType guard set; tests narrow types with it */
  static isExternal(t: TType): t is TExternalType {
    return t.kind === "external";
  }
}

export default TTypeUtils;
