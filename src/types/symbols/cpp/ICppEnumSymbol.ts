import type ICppBaseSymbol from "./ICppBaseSymbol";

/**
 * Symbol representing a C++ enum type definition.
 */
interface ICppEnumSymbol extends ICppBaseSymbol {
  /** Discriminator narrowed to "enum" */
  readonly kind: "enum";

  /** Optional bit width for typed enums (e.g., 8 for uint8_t backing type) */
  readonly bitWidth?: number;
}

export default ICppEnumSymbol;
