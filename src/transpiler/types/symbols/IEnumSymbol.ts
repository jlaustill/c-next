import type IBaseSymbol from "./IBaseSymbol";

/**
 * Symbol representing an enum type definition.
 */
interface IEnumSymbol extends IBaseSymbol {
  /** Discriminator narrowed to "enum" */
  readonly kind: "enum";

  /** Map of member name to numeric value */
  readonly members: ReadonlyMap<string, number>;

  /** Optional explicit bit width (e.g., 8 for u8 backing type) */
  readonly bitWidth?: number;
}

export default IEnumSymbol;
