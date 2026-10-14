import type IBaseSymbol from "./IBaseSymbol";
import type IRegisterMemberSymbol from "./IRegisterMemberSymbol";
import type TExpression from "../syntax/TExpression";

/**
 * Symbol representing a register block definition.
 */
interface IRegisterSymbol extends IBaseSymbol {
  /** Discriminator narrowed to "register" */
  readonly kind: "register";

  /** The base address as 1.2 lowered it; 2.3 renders it (#1991) */
  readonly baseAddress: TExpression;

  /**
   * Members, each a symbol carrying its own span and identity (#1318).
   * Keyed by bare member name, which is how every consumer looks one up.
   */
  readonly members: ReadonlyMap<string, IRegisterMemberSymbol>;
}

export default IRegisterSymbol;
