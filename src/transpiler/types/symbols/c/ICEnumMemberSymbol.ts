import type ICBaseSymbol from "./ICBaseSymbol";

/**
 * Symbol representing a C enum member.
 */
interface ICEnumMemberSymbol extends ICBaseSymbol {
  /** Discriminator narrowed to "enum_member" */
  readonly kind: "enum_member";

  /** Parent enum name */
  readonly parent: string;

  /** Optional explicit value */
  readonly value?: number;
}

export default ICEnumMemberSymbol;
