import type ICBaseSymbol from "./ICBaseSymbol";

/**
 * Symbol representing a C typedef.
 */
interface ICTypedefSymbol extends ICBaseSymbol {
  /** Discriminator narrowed to "type" */
  readonly kind: "type";

  /** The underlying type being aliased */
  readonly type: string;

  /**
   * #1668 (C20): the declarator's array dimensions -- `typedef float vec3[3]`
   * is `[3]` -- so a variable of the typedef is an array, and subscripting it
   * is element access, not a bit of a scalar.
   */
  readonly arrayDimensions?: ReadonlyArray<number | string>;

  /**
   * #1619: `const` among the typedef's specifiers (`typedef const uint8_t
   * CByte`, `typedef const char *cstr_t`); a declarator's `* const` is not it
   */
  readonly isConst?: boolean;
}

export default ICTypedefSymbol;
