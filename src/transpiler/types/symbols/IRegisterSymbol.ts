import type IBaseSymbol from "./IBaseSymbol";
import type IRegisterMemberInfo from "./IRegisterMemberInfo";

/**
 * Symbol representing a register block definition.
 */
interface IRegisterSymbol extends IBaseSymbol {
  /** Discriminator narrowed to "register" */
  readonly kind: "register";

  /** Base address expression (as string, e.g., "0x40000000") */
  readonly baseAddress: string;

  /** Map of member name to register member metadata */
  readonly members: ReadonlyMap<string, IRegisterMemberInfo>;
}

export default IRegisterSymbol;
