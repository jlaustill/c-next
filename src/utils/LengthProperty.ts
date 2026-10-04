/**
 * ADR-058's compile-time length properties -- `.element_count`, `.bit_length`,
 * `.byte_length` -- decided once (#1175).
 *
 * Render writes them into expressions and the constant evaluator folds them
 * into dimensions; both ask here, so `u8[src.element_count]` sizes an array
 * by the number `src.element_count` reads as. Render alone adds a C header
 * type's width, from a table 1.4 may not read; for one of those a property is
 * not a constant.
 */
import TYPE_WIDTH from "../types/TYPE_WIDTH";
import type IElementWidthFacts from "./types/IElementWidthFacts";
import type TType from "../types/TType";

/** ADR-017: an enum is 32 bits wide */
const ENUM_BITS = 32;

const LENGTHS: ReadonlySet<string> = new Set([
  "element_count",
  "bit_length",
  "byte_length",
]);

class LengthProperty {
  /** Whether a member name is one of ADR-058's compile-time length properties */
  static isLength(property: string): boolean {
    return LENGTHS.has(property);
  }

  /**
   * The property's value for a value with `dimensions` whose element is
   * `elementBits` wide; null when a dimension or the width is not known here.
   * `.element_count` is the first dimension; the lengths are every element's
   * bits together, and `.byte_length` is `.bit_length / 8`.
   */
  static of(
    property: string,
    dimensions: ReadonlyArray<number | string>,
    elementBits: number | null,
  ): number | null {
    if (property === "element_count") {
      const first = dimensions[0];
      return typeof first === "number" && first > 0 ? first : null;
    }
    if (elementBits === null || elementBits <= 0) return null;
    let elements = 1;
    for (const dimension of dimensions) {
      if (typeof dimension !== "number" || dimension <= 0) return null;
      elements *= dimension;
    }
    const bits = elements * elementBits;
    return property === "bit_length" ? bits : bits / 8;
  }

  /** ADR-058: a string's element is its whole buffer, `.size` bytes */
  static stringElementBits(capacity: number): number {
    return (capacity + 1) * 8;
  }

  /**
   * A C-Next declared type's element width in bits -- the same answer
   * `elementBits` gives render for the type's name; null for a type whose
   * width C-Next does not fix (a struct, a C header type)
   */
  static elementBitsOfType(type: TType): number | null {
    switch (type.kind) {
      case "primitive":
        return TYPE_WIDTH[type.primitive] ?? null;
      case "enum":
        return ENUM_BITS;
      case "bitmap":
        return type.bitWidth;
      case "string":
        return LengthProperty.stringElementBits(type.capacity);
      default:
        return null;
    }
  }

  /** An element type's width in bits, from C-Next's own types; null if unknown */
  static elementBits(
    typeName: string,
    facts: IElementWidthFacts,
  ): number | null {
    return (
      TYPE_WIDTH[typeName] ??
      facts.enumBitWidth(typeName) ??
      (facts.isEnum(typeName) ? ENUM_BITS : null) ??
      facts.bitmapBitWidth(typeName)
    );
  }
}

export default LengthProperty;
