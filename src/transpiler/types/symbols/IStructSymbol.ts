import type IBaseSymbol from "./IBaseSymbol";
import type IFieldInfo from "./IFieldInfo";

/**
 * Symbol representing a struct type definition.
 */
interface IStructSymbol extends IBaseSymbol {
  /** Discriminator narrowed to "struct" */
  readonly kind: "struct";

  /** Map of field name to field metadata */
  readonly fields: ReadonlyMap<string, IFieldInfo>;
}

export default IStructSymbol;
