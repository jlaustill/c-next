import ESymbolKind from "../../types/ESymbolKind";
import IBaseSymbol from "./IBaseSymbol";

/**
 * Symbol representing an enum type definition.
 */
interface IEnumSymbol extends IBaseSymbol {
  /** Discriminant for type narrowing */
  kind: ESymbolKind.Enum;

  /** Map of member name to numeric value */
  members: Map<string, number>;

  /** Optional explicit bit width (e.g., 8 for u8 backing type) */
  bitWidth?: number;
}

export default IEnumSymbol;
