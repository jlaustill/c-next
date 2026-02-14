import type ICBaseSymbol from "./ICBaseSymbol";

/**
 * Symbol representing a C enum type definition.
 */
interface ICEnumSymbol extends ICBaseSymbol {
  /** Discriminator narrowed to "enum" */
  readonly kind: "enum";

  /** Enum members with their values */
  readonly members: ReadonlyArray<{
    readonly name: string;
    readonly value?: number;
  }>;
}

export default ICEnumSymbol;
