import type IBaseSymbol from "./IBaseSymbol";
import type IStructFieldSymbol from "./IStructFieldSymbol";

/**
 * Symbol representing a struct type definition.
 */
interface IStructSymbol extends IBaseSymbol {
  /** Discriminator narrowed to "struct" */
  readonly kind: "struct";

  /**
   * Fields, each a symbol carrying its own span and identity (#1318).
   * Keyed by bare field name, which is how every consumer looks one up.
   */
  readonly fields: ReadonlyMap<string, IStructFieldSymbol>;
}

export default IStructSymbol;
