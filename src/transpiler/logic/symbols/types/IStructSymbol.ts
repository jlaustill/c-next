import IBaseSymbol from "./IBaseSymbol";
import IFieldInfo from "./IFieldInfo";

/**
 * Symbol representing a struct type definition.
 */
interface IStructSymbol extends IBaseSymbol {
  /** Discriminant for type narrowing */
  kind: "struct";

  /** Map of field name to field metadata */
  fields: Map<string, IFieldInfo>;
}

export default IStructSymbol;
