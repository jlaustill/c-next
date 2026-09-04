import type IBaseSymbol from "./IBaseSymbol";
import type IRegisterMemberSymbol from "./IRegisterMemberSymbol";

/**
 * Symbol representing a register block definition.
 */
interface IRegisterSymbol extends IBaseSymbol {
  /** Discriminator narrowed to "register" */
  readonly kind: "register";

  /** Base address expression (as string, e.g., "0x40000000") */
  readonly baseAddress: string;

  /**
   * Members, each a symbol carrying its own span and identity (#1318).
   * Keyed by bare member name, which is how every consumer looks one up.
   */
  readonly members: ReadonlyMap<string, IRegisterMemberSymbol>;
}

export default IRegisterSymbol;
