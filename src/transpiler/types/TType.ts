/**
 * C-Next Type System - Discriminated Union
 *
 * TType represents all possible types in the C-Next type system.
 * Each variant has a `kind` discriminator for type narrowing.
 *
 * Use TTypeUtils for factory functions and type guards.
 */
import TPrimitiveKind from "./TPrimitiveKind";

/**
 * Primitive type (built-in types that map to C types)
 */
interface TPrimitiveType {
  readonly kind: "primitive";
  readonly primitive: TPrimitiveKind;
}

/**
 * Struct type reference
 */
interface TStructType {
  readonly kind: "struct";
  readonly name: string;
}

/**
 * Enum type reference
 */
interface TEnumType {
  readonly kind: "enum";
  readonly name: string;
}

/**
 * Bitmap type reference
 * Bitmaps have a fixed bit width (8, 16, 24, 32)
 */
interface TBitmapType {
  readonly kind: "bitmap";
  readonly name: string;
  readonly bitWidth: number;
}

/**
 * Array type with element type and dimensions
 * Dimensions can be numbers or strings (for C macro pass-through)
 */
interface TArrayType {
  readonly kind: "array";
  readonly elementType: TType;
  readonly dimensions: ReadonlyArray<number | string>;
}

/**
 * String type with capacity
 * C-Next strings are fixed-capacity char arrays
 */
interface TStringType {
  readonly kind: "string";
  readonly capacity: number;
}

/**
 * Callback type reference (function pointer type)
 */
interface TCallbackType {
  readonly kind: "callback";
  readonly name: string;
}

/**
 * Hardware register type
 */
interface TRegisterType {
  readonly kind: "register";
  readonly name: string;
}

/**
 * External type (C++ templates, external classes)
 * Passes through unchanged to generated code
 */
interface TExternalType {
  readonly kind: "external";
  readonly name: string;
}

/**
 * Discriminated union of all C-Next types
 */
type TType =
  | TPrimitiveType
  | TStructType
  | TEnumType
  | TBitmapType
  | TArrayType
  | TStringType
  | TCallbackType
  | TRegisterType
  | TExternalType;

export default TType;
