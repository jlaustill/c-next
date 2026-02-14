import type ICBaseSymbol from "./ICBaseSymbol";

/**
 * Symbol representing a C typedef.
 */
interface ICTypedefSymbol extends ICBaseSymbol {
  /** Discriminator narrowed to "type" */
  readonly kind: "type";

  /** The underlying type being aliased */
  readonly type: string;
}

export default ICTypedefSymbol;
