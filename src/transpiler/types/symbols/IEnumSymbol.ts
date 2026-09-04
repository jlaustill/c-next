import type IBaseSymbol from "./IBaseSymbol";
import type IEnumMemberSymbol from "./IEnumMemberSymbol";

/**
 * Symbol representing an enum type definition.
 */
interface IEnumSymbol extends IBaseSymbol {
  /** Discriminator narrowed to "enum" */
  readonly kind: "enum";

  /**
   * Members, each carrying its own span and its own identity (#1318).
   *
   * Keyed by bare member name, which is how every consumer looks one up.
   * The value used to be the bare number, so a member had no position and
   * every consumer that wanted one reported the enum's.
   */
  readonly members: ReadonlyMap<string, IEnumMemberSymbol>;

  /** Optional explicit bit width (e.g., 8 for u8 backing type) */
  readonly bitWidth?: number;
}

export default IEnumSymbol;
