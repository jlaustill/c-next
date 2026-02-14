import type ICppBaseSymbol from "./ICppBaseSymbol";

/**
 * Symbol representing a C++ type alias (using X = Y).
 */
interface ICppTypeAliasSymbol extends ICppBaseSymbol {
  /** Discriminator narrowed to "type" */
  readonly kind: "type";

  /** The underlying type being aliased (optional, may not be parsed) */
  readonly type?: string;
}

export default ICppTypeAliasSymbol;
