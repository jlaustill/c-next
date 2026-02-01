import ESymbolKind from "../../../../utils/types/ESymbolKind";
import IBaseSymbol from "./IBaseSymbol";
import IRegisterMemberInfo from "./IRegisterMemberInfo";

/**
 * Symbol representing a register block definition.
 * Registers provide typed access to memory-mapped I/O locations.
 */
interface IRegisterSymbol extends IBaseSymbol {
  /** Discriminant for type narrowing */
  kind: ESymbolKind.Register;

  /** Base address expression (as string, e.g., "0x40000000") */
  baseAddress: string;

  /** Map of member name to register member metadata */
  members: Map<string, IRegisterMemberInfo>;
}

export default IRegisterSymbol;
