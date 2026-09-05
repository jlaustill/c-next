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
 * A bare type name 1.3 Declare could not settle, carried unresolved to 1.4.
 *
 * ADR-057 resolves a bare `T` local -> scope -> global, and inside a scope that
 * question needs to know every scope type the PROGRAM declares -- a cross-file
 * fact. Declare owns per-file facts only, so for a bare name it does not itself
 * declare, its honest answer is "I do not know", not a guess.
 *
 * This is an arm rather than a flag on purpose. Once a type name is a plain
 * string, `global.Mode` and a bare `Mode` are byte-identical and nothing can
 * tell a settled name from an unsettled one -- which is why ADR-057 forbids
 * qualifying after resolution. Making it a variant means every `switch` over
 * `TType` stops compiling until it decides what to do here, so a pass that
 * would silently emit the unresolved name cannot be written by accident.
 *
 * `name` is the identifier exactly as written, and only ever a bare one:
 * `this.T`, `global.T` and `Scope.T` state their answer in the syntax and are
 * settled by Declare. `scopePath` is where the reference appeared, because
 * ADR-057 needs both to resolve it.
 *
 * Nothing after 1.4 Resolve may hold one of these.
 */
interface TDeferredType {
  readonly kind: "deferred";
  readonly name: string;
  readonly scopePath: string;
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
  | TExternalType
  | TDeferredType;

export default TType;
