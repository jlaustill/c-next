import ESymbolKind from "../../../../utils/types/ESymbolKind";
import IBaseSymbol from "./IBaseSymbol";
import IFieldInfo from "./IFieldInfo";

/**
 * Symbol representing a struct type definition.
 */
interface IStructSymbol extends IBaseSymbol {
  /** Discriminant for type narrowing */
  kind: ESymbolKind.Struct;

  /** Map of field name to field metadata */
  fields: Map<string, IFieldInfo>;
}

export default IStructSymbol;
