import type ICppBaseSymbol from "./ICppBaseSymbol";

/**
 * Symbol representing a C++ enum member.
 */
interface ICppEnumMemberSymbol extends ICppBaseSymbol {
  /** Discriminator narrowed to "enum_member" */
  readonly kind: "enum_member";

  /** Optional explicit value */
  readonly value?: number;
}

export default ICppEnumMemberSymbol;
